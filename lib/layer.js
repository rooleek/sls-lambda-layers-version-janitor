const AWS = require("aws-sdk");
const {bailWrapper} = require("./common");
const lambda = new AWS.Lambda();

const MaxItems = 50;

const listLayersVersions = async (LayerName) => {
  return bailWrapper(lambda.listLayerVersions({LayerName, MaxItems}), "List layer versions");
};

const listLayers = async (prefix) => {
  const result = await bailWrapper(lambda.listLayers({MaxItems}), "List layers");
  return (result && result.Layers || []).filter((layer) => `${layer.LayerName}`.startsWith(prefix));
};

const deleteLayerVersion = async (params) => {
  return bailWrapper(lambda.deleteLayerVersion(params), "Delete layer");
};

function later(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay);
  });
}

module.exports = {
  listLayersVersions,
  listLayers,
  deleteLayerVersion,
  delay: later
};


