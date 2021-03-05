const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
const _ = require("lodash");
const log = require("@dazn/lambda-powertools-logger");
const {bailWrapper} = require("./common");


const listFunctions = async () => {
  log.info("listing all available functions...");

  const loop = async (acc = [], marker) => {
    const res = await bailWrapper(lambda.listFunctions({
      Marker: marker,
      MaxItems: 10
    }), "retrying listFunctions after error...");

    const functions = res.Functions.map(x => x.FunctionArn);
    const newAcc = acc.concat(functions);

    if (res.NextMarker) {
      return loop(newAcc, res.NextMarker);
    } else {
      // Shuffle newAcc array
      log.info(`found ${newAcc.length} functions`, {count: newAcc.length});
      return newAcc.sort(() => Math.random() - Math.random());
    }
  };

  return loop();
};

const listVersions = async (funcArn) => {
  log.debug("listing versions...", {function: funcArn});

  const loop = async (acc = [], marker) => {
    const res = await bailWrapper(lambda.listVersionsByFunction({
      FunctionName: funcArn,
      Marker: marker,
      MaxItems: 20
    }), "retrying listVersionsByFunction after error...");

    const versions = res.Versions.map(x => x.Version).filter(x => x !== "$LATEST");
    const newAcc = acc.concat(versions);

    if (res.NextMarker) {
      return loop(newAcc, res.NextMarker);
    } else {
      log.debug("found versions [NOT $LATEST]", {versions: newAcc.join(",")});
      return newAcc;
    }
  };

  return loop();
};

const listAliasedVersions = async (funcArn) => {
  log.debug("listing aliased versions...", {function: funcArn});

  const loop = async (acc = [], marker) => {
    const res = await bailWrapper(lambda.listAliases({
      FunctionName: funcArn,
      Marker: marker,
      MaxItems: 20
    }), "retrying listAliases after error...");

    const versions = _.flatMap(res.Aliases, alias => {
      const versions = [alias.FunctionVersion];
      if (alias.RoutingConfig) {
        const additionalVersions = Object.keys(alias.RoutingConfig.AdditionalVersionWeights);
        return versions.concat(additionalVersions);
      } else {
        return versions;
      }
    });
    const newAcc = acc.concat(versions);

    if (res.NextMarker) {
      return loop(newAcc, res.NextMarker);
    } else {
      const uniqueVersions = _.uniq(newAcc);
      log.debug("found aliased versions", {
        count: versions.length,
        versions: uniqueVersions.join(",")
      });
      return uniqueVersions;
    }
  };

  return loop();
};

const deleteVersion = async (funcArn, version) => {
  log.info("deleting...", {function: funcArn, version});
  await bailWrapper(lambda.deleteFunction({
    FunctionName: funcArn,
    Qualifier: version
  }), "retrying deleteFunction after error...");
};

module.exports = {
  listFunctions,
  listVersions,
  listAliasedVersions,
  deleteVersion
};
