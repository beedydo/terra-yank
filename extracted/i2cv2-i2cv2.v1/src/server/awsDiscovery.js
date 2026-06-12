const { SearchCommand } = require("@aws-sdk/client-resource-explorer-2");
const { GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { ListAccountAliasesCommand } = require("@aws-sdk/client-iam");
const { getClients } = require("./awsClients");
const { importSupport } = require("./imports");
const { parseArn, slugify } = require("./utils");

const SKIP_RESOURCE_TYPES = new Set([
  "lambda:function/version",
  "resource-explorer-2:index",
  "resource-explorer-2:view",
]);

function extractTags(properties) {
  if (!Array.isArray(properties)) return {};
  const tagsProp = properties.find((p) => p.Name === "tags");
  if (!tagsProp || !Array.isArray(tagsProp.Data)) return {};
  const tags = {};
  for (const tag of tagsProp.Data) {
    if (tag.Key) tags[tag.Key] = tag.Value || "";
  }
  return tags;
}

function isGcciOwned(tags) {
  const normalized = {};
  for (const [key, value] of Object.entries(tags || {})) {
    normalized[String(key).toLowerCase()] = String(value).toLowerCase();
  }

  return (
    "gcci" in normalized ||
    normalized["gcc:team"] === "gcci" ||
    normalized.gcc_team === "gcci" ||
    normalized.team === "gcci"
  );
}

function gcciValue(tags) {
  return tags.gcci || tags.GCCI || tags["gcc:team"] || tags.gcc_team || tags.Team || tags.team || "gcci";
}

function categoryLabel(category) {
  const labels = {
    "network/vpc": "VPCs",
    "network/vpce": "VPC Endpoints",
    "network/network_interface": "Network Interfaces",
    "network/subnet": "Subnets",
    "network/route_table": "Route Tables",
    "network/network_acl": "Network ACLs",
    "network/internet_gateway": "Internet Gateways",
    "network/nat_gateway": "NAT Gateways",
    "network/security_group": "Security Groups",
    "network/security_group_rule": "Security Group Rules",
    "network/load_balancer": "Load Balancers",
    "network/elastic_ip": "Elastic IPs",
    "network/network_insights": "Network Insights",
    "network/flow_log": "VPC Flow Logs",
    "network/transit_gateway": "Transit Gateways",
    "network/prefix_list": "Prefix Lists",
    "compute/ec2_instance": "EC2 Instances",
    "compute/ec2_ami": "AMIs",
    "compute/ec2_key_pair": "Key Pairs",
    "compute/launch_template": "Launch Templates",
    "compute/lambda": "Lambda Functions",
    "containers/eks": "EKS",
    "containers/ecs": "ECS",
    "containers/ecr": "ECR",
    "storage/ebs_volume": "EBS Volumes",
    "storage/ec2_snapshot": "EBS Snapshots",
    "storage/s3_bucket": "S3 Buckets",
    "data/rds": "RDS",
    "data/dynamodb": "DynamoDB",
    "security/kms": "KMS Keys",
    "security/secrets": "Secrets Manager",
    "management/ssm": "SSM",
    "integration/eventbridge": "EventBridge",
    "integration/sns": "SNS",
    "integration/sqs": "SQS",
    "governance/config": "AWS Config",
    "observability/logs": "CloudWatch Logs",
    "identity/iam": "IAM",
  };
  return labels[category] || category;
}

function resourceCategory(resource) {
  const parsed = parseArn(resource.arn);
  const id = parsed.resourceId || "";
  const raw = parsed.resourceRaw || "";

  if (parsed.service === "ec2") {
    if (raw.startsWith("vpc-endpoint/") || id.startsWith("vpce-")) return "network/vpce";
    if (raw.startsWith("network-interface/") || id.startsWith("eni-")) return "network/network_interface";
    if (raw.startsWith("vpc/") || id.startsWith("vpc-")) return "network/vpc";
    if (raw.startsWith("subnet/") || id.startsWith("subnet-")) return "network/subnet";
    if (raw.startsWith("route-table/") || id.startsWith("rtb-")) return "network/route_table";
    if (raw.startsWith("network-acl/") || id.startsWith("acl-")) return "network/network_acl";
    if (raw.startsWith("internet-gateway/") || id.startsWith("igw-")) return "network/internet_gateway";
    if (raw.startsWith("natgateway/") || id.startsWith("nat-")) return "network/nat_gateway";
    if (raw.startsWith("security-group/") || id.startsWith("sg-")) return "network/security_group";
    if (raw.startsWith("security-group-rule/") || id.startsWith("sgr-")) return "network/security_group_rule";
    if (raw.startsWith("instance/") || id.startsWith("i-")) return "compute/ec2_instance";
    if (raw.startsWith("volume/") || id.startsWith("vol-")) return "storage/ebs_volume";
    if (raw.startsWith("snapshot/") || id.startsWith("snap-")) return "storage/ec2_snapshot";
    if (raw.startsWith("image/") || id.startsWith("ami-")) return "compute/ec2_ami";
    if (raw.startsWith("key-pair/")) return "compute/ec2_key_pair";
    if (raw.startsWith("elastic-ip/") || id.startsWith("eipalloc-")) return "network/elastic_ip";
    if (raw.startsWith("launch-template/") || id.startsWith("lt-")) return "compute/launch_template";
    if (raw.startsWith("network-insights-path/")) return "network/network_insights";
    if (raw.startsWith("flow-log/")) return "network/flow_log";
    if (raw.startsWith("transit-gateway/") || id.startsWith("tgw-")) return "network/transit_gateway";
    if (raw.startsWith("prefix-list/") || id.startsWith("pl-")) return "network/prefix_list";
  }

  if (parsed.service === "elasticloadbalancing") return "network/load_balancer";
  if (parsed.service === "eks") return "containers/eks";
  if (parsed.service === "ecs") return "containers/ecs";
  if (parsed.service === "ecr") return "containers/ecr";
  if (parsed.service === "lambda") return "compute/lambda";
  if (parsed.service === "rds") return "data/rds";
  if (parsed.service === "dynamodb") return "data/dynamodb";
  if (parsed.service === "s3") return "storage/s3_bucket";
  if (parsed.service === "kms") return "security/kms";
  if (parsed.service === "secretsmanager") return "security/secrets";
  if (parsed.service === "ssm") return "management/ssm";
  if (parsed.service === "events" || parsed.service === "scheduler") return "integration/eventbridge";
  if (parsed.service === "sns") return "integration/sns";
  if (parsed.service === "sqs") return "integration/sqs";
  if (parsed.service === "config") return "governance/config";
  if (parsed.service === "logs") return "observability/logs";
  if (parsed.service === "iam") return "identity/iam";
  return `other/${parsed.service || "unknown"}`;
}

function suggestedProject(resource) {
  const tags = resource.tags || {};
  return slugify(
    tags.Project ||
      tags.project ||
      tags.Application ||
      tags.application ||
      tags.App ||
      tags.Service ||
      tags.Name ||
      resource.categoryLabel ||
      resource.service ||
      "default",
  );
}

function groupBy(items, keyFn, baseFactory) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = baseFactory(item, key);
    groups[key].count += 1;
    groups[key].services[item.service] = (groups[key].services[item.service] || 0) + 1;
    groups[key].resources.push(item);
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

async function getAccountInfo(region, credentials) {
  const { sts, iam } = getClients(region, credentials);
  const identity = await sts.send(new GetCallerIdentityCommand({}));

  let accountName = "Unknown";
  try {
    const aliases = await iam.send(new ListAccountAliasesCommand({}));
    if (aliases.AccountAliases?.length) accountName = aliases.AccountAliases[0];
  } catch (_) {
    // Alias lookup is optional.
  }

  return { accountId: identity.Account, accountName, arn: identity.Arn };
}

async function searchResourceExplorer(client, queryString) {
  const results = [];
  let nextToken;
  let pages = 0;

  do {
    const response = await client.send(
      new SearchCommand({
        QueryString: queryString,
        MaxResults: 1000,
        ...(nextToken && { NextToken: nextToken }),
      }),
    );

    pages++;
    for (const item of response.Resources || []) {
      if (SKIP_RESOURCE_TYPES.has(item.ResourceType)) continue;
      results.push(item);
    }

    nextToken = response.NextToken;
    if (!nextToken && response.Count && response.Count.Complete === false) {
      console.warn(`Resource Explorer: incomplete results for "${queryString}" (${results.length} returned). The index may need to be an aggregator to cover all regions.`);
    }
  } while (nextToken);

  console.log(`Resource Explorer: "${queryString}" returned ${results.length} resources (${pages} page(s))`);
  return results;
}

async function discoverResources(region, credentials) {
  const { resourceExplorer: client } = getClients(region, credentials);
  const gcciTagged = [];
  const notTagged = [];

  const [regionalResults, globalResults, ...supplementalResults] = await Promise.all([
    searchResourceExplorer(client, `region:${region}`),
    searchResourceExplorer(client, "region:global"),
    searchResourceExplorer(client, `region:${region} resourcetype:s3:bucket`),
    searchResourceExplorer(client, `region:${region} resourcetype:ec2:instance`),
    searchResourceExplorer(client, `region:${region} resourcetype:ec2:vpc`),
    searchResourceExplorer(client, `region:${region} resourcetype:ec2:subnet`),
    searchResourceExplorer(client, `region:${region} resourcetype:ec2:security-group`),
    searchResourceExplorer(client, `region:${region} resourcetype:ec2:volume`),
    searchResourceExplorer(client, `region:${region} resourcetype:lambda:function`),
    searchResourceExplorer(client, `region:${region} resourcetype:rds:db`),
  ]);

  const seen = new Set();
  const allResults = [];
  for (const item of [...regionalResults, ...globalResults, ...supplementalResults.flat()]) {
    if (seen.has(item.Arn)) continue;
    seen.add(item.Arn);
    allResults.push(item);
  }

  for (const item of allResults) {
    const tags = extractTags(item.Properties);
    const parsed = parseArn(item.Arn);
    const resource = {
      arn: item.Arn,
      service: parsed.service,
      resourceType: parsed.resourceType,
      tags,
    };
    resource.category = resourceCategory(resource);
    resource.categoryLabel = categoryLabel(resource.category);
    resource.suggestedProject = suggestedProject(resource);
    Object.assign(resource, importSupport(resource));

    if (isGcciOwned(tags)) {
      resource.gcciValue = gcciValue(tags);
      gcciTagged.push(resource);
    } else {
      notTagged.push(resource);
    }
  }

  return {
    region,
    totalDiscovered: gcciTagged.length + notTagged.length,
    gcciTaggedCount: gcciTagged.length,
    notTaggedCount: notTagged.length,
    gcciGroups: groupBy(gcciTagged, (r) => r.gcciValue || "gcci", (_r, key) => ({
      gcciValue: key,
      count: 0,
      services: {},
      resources: [],
    })),
    notTaggedCategoryGroups: groupBy(notTagged, (r) => r.category || "other/unknown", (r, key) => ({
      category: key,
      label: r.categoryLabel || key,
      count: 0,
      services: {},
      resources: [],
    })),
  };
}

module.exports = {
  discoverResources,
  getAccountInfo,
  groupBy,
  resourceCategory,
  categoryLabel,
};
