const { parseArn, slugify } = require("./utils");
const resourceMap = require("./resource-map.json");
const { DescribeSecurityGroupRulesCommand } = require("@aws-sdk/client-ec2");
const { DescribeConfigRulesCommand } = require("@aws-sdk/client-config-service");
const { getClients } = require("./awsClients");

function mapToTerraformImport(resource) {
  const parsed = parseArn(resource.arn);

  // GuardDuty sub-resources: detector/{id}/filter/{name} or detector/{id}/threatintelset/{id}
  if (parsed.service === "guardduty" && parsed.resourceId.includes("/")) {
    const parts = parsed.resourceId.split("/");
    if (parts.length >= 3 && parts[1] === "filter") {
      return { tfType: "aws_guardduty_filter", importId: `${parts[0]}:${parts.slice(2).join("/")}` };
    }
    if (parts.length >= 3 && parts[1] === "threatintelset") {
      return { tfType: "aws_guardduty_threatintelset", importId: `${parts[0]}:${parts[2]}` };
    }
    if (parts.length >= 3 && parts[1] === "ipset") {
      return { tfType: "aws_guardduty_ipset", importId: `${parts[0]}:${parts[2]}` };
    }
  }

  const specificKey = `${parsed.service}:${parsed.resourceType}`;
  let mapping = resourceMap.resources[specificKey];

  if (!mapping) mapping = resourceMap.resources[parsed.service];

  if (!mapping) return null;

  let importId;
  if (mapping.importIdTemplate) {
    importId = mapping.importIdTemplate
      .replace("${region}", parsed.region)
      .replace("${accountId}", parsed.accountId)
      .replace("${resourceId}", parsed.resourceId)
      .replace("${resourceRaw}", parsed.resourceRaw)
      .replace("${resourceType}", parsed.resourceType)
      .replace("${arn}", resource.arn);
  } else if (mapping.importIdField === "arn") importId = resource.arn;
  else if (mapping.importIdField === "resourceRaw") importId = parsed.resourceRaw;
  else importId = parsed.resourceId;

  return { tfType: mapping.tfType, importId };
}

const NOT_RECOMMENDED = new Set([
  "cloudformation:stack",
  "cloudformation:stackset",
  "ec2:network-insights-analysis",
  "ec2:network-insights-path",
  "ec2:snapshot",
  "rds:og",
  "rds:snapshot",
  "ssm:association",
]);

// SSM parameter names that start with "ssm" (case-insensitive) cannot be read by the Terraform
// AWS provider due to AWS API validation rejecting the prefixed path.
const SSM_INVALID_PREFIXES = ["ssm", "aws", "awsmp"];

function importSupport(resource) {
  const parsed = parseArn(resource.arn);
  const reKey = `${parsed.service}:${parsed.resourceType}`;
  if (NOT_RECOMMENDED.has(reKey)) {
    return {
      importSupported: false,
      unsupportedReason: "Not recommended for Terraform management",
    };
  }
  // MemoryDB default parameter groups have dots in name — terraform provider rejects dots
  if (reKey === "memorydb:parametergroup" && parsed.resourceId.includes(".")) {
    return {
      importSupported: false,
      unsupportedReason: "Default parameter group (name contains dots, incompatible with Terraform provider)",
    };
  }
  // SSM parameters with reserved prefixes cannot be read by Terraform AWS provider
  if (reKey === "ssm:parameter") {
    const paramName = parsed.resourceId.split("/")[0].toLowerCase();
    if (SSM_INVALID_PREFIXES.some((prefix) => paramName.startsWith(prefix))) {
      return {
        importSupported: false,
        unsupportedReason: "SSM parameter name uses reserved prefix — AWS API rejects reads via Terraform provider",
      };
    }
  }
  const mapping = mapToTerraformImport(resource);
  if (!mapping) {
    return {
      importSupported: false,
      unsupportedReason: "No import mapping configured",
    };
  }
  return { importSupported: true, tfType: mapping.tfType, importId: mapping.importId };
}

async function resolveConfigRuleNames(importIds, region, credentials) {
  if (!importIds.length || !region) return {};
  try {
    const { configService } = getClients(region, credentials);
    // importIds are like "aws-service-rule/securityhub.amazonaws.com/config-rule-vexegc"
    // ConfigRuleId from API is just "config-rule-vexegc" (last segment)
    // Build map: shortId -> original importId
    const shortToImportId = new Map();
    for (const id of importIds) {
      const shortId = id.split("/").pop();
      shortToImportId.set(shortId, id);
    }
    const result = {};
    let nextToken;
    do {
      const resp = await configService.send(new DescribeConfigRulesCommand({
        ...(nextToken ? { NextToken: nextToken } : {}),
      }));
      for (const rule of resp.ConfigRules || []) {
        const ruleId = rule.ConfigRuleId || "";
        if (shortToImportId.has(ruleId)) {
          const originalImportId = shortToImportId.get(ruleId);
          result[originalImportId] = rule.ConfigRuleName;
        }
      }
      nextToken = resp.NextToken;
      if (Object.keys(result).length >= shortToImportId.size) break;
    } while (nextToken);
    console.log(`[imports] resolveConfigRuleNames: matched ${Object.keys(result).length}/${importIds.length}`);
    return result;
  } catch (err) {
    console.error("[imports] resolveConfigRuleNames error:", err.message);
    return {};
  }
}

async function resolveSecurityGroupRules(sgrIds, region, credentials) {
  if (!sgrIds.length || !region) return {};
  try {
    const { ec2 } = getClients(region, credentials);
    const resp = await ec2.send(new DescribeSecurityGroupRulesCommand({
      SecurityGroupRuleIds: sgrIds,
    }));
    const result = {};
    for (const rule of resp.SecurityGroupRules || []) {
      result[rule.SecurityGroupRuleId] = { isEgress: rule.IsEgress };
    }
    return result;
  } catch {
    return {};
  }
}

async function buildImportArtifact({ selection, region, account, credentials }) {
  const selectedResources = Array.isArray(selection) ? selection : [];
  const mappedResources = [];
  const unsupportedResources = [];

  selectedResources.forEach((resource, idx) => {
    const mapped = mapToTerraformImport(resource);
    if (!mapped) {
      unsupportedResources.push({
        arn: resource.arn,
        service: resource.service,
        resourceType: resource.resourceType,
        reason: "unsupported_resource_type_for_auto_mapping",
      });
      return;
    }

    const importProject = slugify(resource.category || resource.service || "default");
    mappedResources.push({
      ...resource,
      ...mapped,
      importProject,
      logicalName: `${mapped.tfType}_${slugify(resource.resourceType || resource.service)}_${idx + 1}`,
    });
  });

  const sgrResources = mappedResources.filter(
    (r) => r.tfType === "aws_vpc_security_group_ingress_rule" || r.tfType === "aws_vpc_security_group_egress_rule"
  );
  if (sgrResources.length) {
    const sgrIds = sgrResources.map((r) => r.importId);
    const resolved = await resolveSecurityGroupRules(sgrIds, region, credentials);
    for (const r of sgrResources) {
      const info = resolved[r.importId];
      if (info?.isEgress) {
        r.tfType = "aws_vpc_security_group_egress_rule";
        r.logicalName = r.logicalName.replace("aws_vpc_security_group_ingress_rule", "aws_vpc_security_group_egress_rule");
      }
    }
  }

  // Resolve config rule names (import ID must be rule name, not config-rule-id)
  const configRuleResources = mappedResources.filter((r) => r.tfType === "aws_config_config_rule");
  if (configRuleResources.length) {
    const configRuleIds = configRuleResources.map((r) => r.importId);
    const resolved = await resolveConfigRuleNames(configRuleIds, region, credentials);
    for (const r of configRuleResources) {
      const ruleName = resolved[r.importId];
      if (ruleName) {
        r.importId = ruleName;
      }
    }
  }

  const byProject = {};
  for (const item of mappedResources) {
    if (!byProject[item.importProject]) byProject[item.importProject] = [];
    byProject[item.importProject].push(item);
  }

  const files = Object.entries(byProject).map(([project, resources]) => {
    const importsTf = resources.map((item) => [
      "import {",
      `  to = ${item.tfType}.${item.logicalName}`,
      `  id = "${item.importId}"`,
      "}",
      "",
      `resource "${item.tfType}" "${item.logicalName}" {`,
      "  # TODO: fill arguments after import and terraform plan review",
      "}",
      "",
    ].join("\n")).join("\n");

    return {
      project,
      importsPath: `${project}/imports.tf`,
      selectionPath: `${project}/selection.json`,
      importsTf,
      resources,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    region,
    account,
    totalSelected: selectedResources.length,
    terraformMappableCount: mappedResources.length,
    unsupportedCount: unsupportedResources.length,
    mappedResources,
    unsupportedResources,
    files,
    importsTf: files.map((file) => [`# Project: ${file.project}`, `# File: ${file.importsPath}`, file.importsTf].join("\n")).join("\n\n"),
  };
}

module.exports = {
  buildImportArtifact,
  importSupport,
  mapToTerraformImport,
  resolveConfigRuleNames,
};
