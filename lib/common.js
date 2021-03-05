const retry = require("async-retry");
const log = require("@dazn/lambda-powertools-logger");

const bailIfErrorNotRetryable = (bail) => (error) => {
  if (!error.retryable) {
    bail(error);
  } else {
    throw error;
  }
};

const getRetryConfig = (onRetry) => (
  {
    retries: parseInt(process.env.RETRIES || "5"),
    minTimeout: parseFloat(process.env.RETRY_MIN_TIMEOUT || "5000"),
    maxTimeout: parseFloat(process.env.RETRY_MAX_TIMEOUT || "60000"),
    factor: 2,
    onRetry
  }
);

const bailWrapper = async (func, warn) => {
  return retry((bail) => func.promise().catch(bailIfErrorNotRetryable(bail)),
    getRetryConfig((err) => {
      log.warn(warn, err);
    }));
};

module.exports = {
  bailIfErrorNotRetryable,
  getRetryConfig,
  bailWrapper
};
