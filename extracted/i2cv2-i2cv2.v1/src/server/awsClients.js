const {
  ResourceGroupsTaggingAPIClient,
} = require("@aws-sdk/client-resource-groups-tagging-api");
const { ResourceExplorer2Client } = require("@aws-sdk/client-resource-explorer-2");
const { STSClient } = require("@aws-sdk/client-sts");
const { IAMClient } = require("@aws-sdk/client-iam");
const { EC2Client } = require("@aws-sdk/client-ec2");
const { ConfigServiceClient } = require("@aws-sdk/client-config-service");

const clientCache = {};

function getClients(region, credentials) {
  if (credentials) {
    return {
      sts: new STSClient({ region, credentials }),
      iam: new IAMClient({ region, credentials }),
      tagging: new ResourceGroupsTaggingAPIClient({ region, credentials }),
      resourceExplorer: new ResourceExplorer2Client({ region, credentials }),
      ec2: new EC2Client({ region, credentials }),
      configService: new ConfigServiceClient({ region, credentials }),
    };
  }
  if (!clientCache[region]) {
    clientCache[region] = {
      sts: new STSClient({ region }),
      iam: new IAMClient({ region }),
      tagging: new ResourceGroupsTaggingAPIClient({ region }),
      resourceExplorer: new ResourceExplorer2Client({ region }),
      ec2: new EC2Client({ region }),
      configService: new ConfigServiceClient({ region }),
    };
  }
  return clientCache[region];
}

module.exports = { getClients };
