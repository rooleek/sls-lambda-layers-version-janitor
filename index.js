const _ = require("lodash");
const lambda = require("./lib/lambda");
const layer = require("./lib/layer");
const log = require("@dazn/lambda-powertools-logger");
const {CodePipeline} = require('aws-sdk');

let functions = [];

//LAMBDA_ARN_PREFIX
//LAYER_ARN_PREFIX
//VERSIONS_TO_KEEP
//RETRIES
//RETRY_MIN_TIMEOUT
//RETRY_MAX_TIMEOUT


module.exports.handler = async (event) => {
  const codePipeline = new CodePipeline();
  let jobId = event["CodePipeline.job"].id;
  console.log('event', JSON.stringify(event));

  try {
    await Promise.all([
      cleanFunctionsVersions(),
      cleanLayers()
    ]);

    await codePipeline.putJobSuccessResult({jobId}).promise();
  } catch (e) {

    console.error(e);
    await codePipeline.putJobFailureResult({
      failureDetails: {
        message: 'Failed to clean old versions of lambda',
        type: "JobFailed"
      },
      jobId
    }).promise();
  }

  log.debug("all done");
};

const cleanFunctionsVersions = async () => {

  if(!process.env.LAMBDA_ARN_PREFIX){
    return Promise.resolve();
  }

  if (functions.length === 0) {
    functions = await lambda.listFunctions();
    functions = functions.filter((func) => {
      return `${func}`.indexOf(process.env.LAMBDA_ARN_PREFIX) !== -1;
    });
  }

  const toClean = functions.map(x => x);
  log.debug(`${toClean.length} functions to clean...`, {
    functions: toClean,
    count: toClean.length
  });

  for (const func of toClean) {
    await cleanFunc(func);
    functions = functions.filter((item) => item !== func);
  }
};

const cleanLayers = async () => {

  if(!process.env.LAYER_ARN_PREFIX){
    return Promise.resolve();
  }

  const layers = await layer.listLayers(process.env.LAYER_ARN_PREFIX);

  for (const {LayerName} of layers) {
    let versions = await layer.listLayersVersions(LayerName);

    const versionsToKeep = parseInt(process.env.VERSIONS_TO_KEEP || "3");
    if (versions.LayerVersions && Array.isArray(versions.LayerVersions) && versions.LayerVersions.length > versionsToKeep) {
      versions = versions.LayerVersions;
    } else {
      continue;
    }

    versions = _.orderBy(versions, v => parseInt(v.Version), "desc");
    log.debug(`keeping the most recent ${versionsToKeep} versions`);
    versions = _.drop(versions, versionsToKeep);
		for (const {Version:VersionNumber} of versions) {
			log.debug(`deleting...`, {
				LayerName,
				VersionNumber
			});

			await layer.deleteLayerVersion({
				LayerName,
				VersionNumber
			});
		}
  }
};

const cleanFunc = async (funcArn) => {
  log.debug("cleaning functions...", {function: funcArn});

  const aliasedVersions = await lambda.listAliasedVersions(funcArn);
  let versions = (await lambda.listVersions(funcArn));
  // 242, 241, 240, ...
  versions = _.orderBy(versions, v => parseInt(v), "desc");

  const versionsToKeep = parseInt(process.env.VERSIONS_TO_KEEP || "3");

  // drop the most recent N versions
  log.debug(`keeping the most recent ${versionsToKeep} versions`);
  versions = _.drop(versions, versionsToKeep);

  for (const version of versions) {
    if (!aliasedVersions.includes(version)) {
      await lambda.deleteVersion(funcArn, version);
    }
  }
};
