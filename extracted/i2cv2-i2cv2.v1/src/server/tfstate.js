const resourceMap = require("./resource-map.json");
const DISCOVERABLE_TF_TYPES = new Set(
  Object.values(resourceMap.resources).map((r) => r.tfType),
);

function normalizeArn(arn) {
  if (!arn) return null;
  return String(arn).toLowerCase().replace(/:?\*?$/, "").replace(/:$/, "");
}

function normalizeId(id) {
  if (!id) return null;
  return String(id).replace(/:?\*$/, "");
}

function regionFromArn(arn) {
  if (!arn) return null;
  const parts = String(arn).split(":");
  return parts.length >= 4 ? parts[3] || "global" : null;
}

function parseTfstate(json, fileName) {
  if (json.version !== 4 || !Array.isArray(json.resources)) {
    throw new Error(`Invalid tfstate format in ${fileName}: expected version 4 with resources array.`);
  }

  const entries = [];

  for (const resource of json.resources) {
    if (resource.mode !== "managed") continue;
    if (!resource.provider || !resource.provider.includes("hashicorp/aws")) continue;

    for (const instance of resource.instances || []) {
      const attrs = instance.attributes || {};
      entries.push({
        tfType: resource.type,
        name: resource.name,
        module: resource.module || null,
        provider: resource.provider || null,
        arn: attrs.arn || null,
        id: attrs.id || null,
        sourceFile: fileName,
      });
    }
  }

  return entries;
}

function buildTfstateIndex(parsedEntries) {
  const arnMap = new Map();
  const idMap = new Map();

  for (const entry of parsedEntries) {
    const normalizedArn = normalizeArn(entry.arn);
    if (normalizedArn) {
      arnMap.set(normalizedArn, entry);
    }
    if (entry.tfType && entry.id) {
      idMap.set(`${entry.tfType}:${normalizeId(entry.id)}`, entry);
    }
  }

  return { arnMap, idMap, allEntries: parsedEntries };
}

function compareTfstate(discoveredResources, index, region) {
  const managed = [];
  const unmanaged = [];
  const matchedArnKeys = new Set();
  const matchedIdKeys = new Set();

  for (const resource of discoveredResources) {
    const normalizedArn = normalizeArn(resource.arn);
    let match = null;

    if (normalizedArn && index.arnMap.has(normalizedArn)) {
      match = index.arnMap.get(normalizedArn);
      matchedArnKeys.add(normalizedArn);
    }

    if (!match && resource.importSupported && resource.tfType && resource.importId) {
      const idKey = `${resource.tfType}:${normalizeId(resource.importId)}`;
      if (index.idMap.has(idKey)) {
        match = index.idMap.get(idKey);
        matchedIdKeys.add(idKey);
      }
    }

    if (match) {
      managed.push({
        ...resource,
        managedBy: { tfType: match.tfType, name: match.name, module: match.module, provider: match.provider, sourceFile: match.sourceFile },
      });
    } else {
      unmanaged.push(resource);
    }
  }

  const staleStateResources = [];
  const subResources = [];

  for (const entry of index.allEntries) {
    const normalizedArn = normalizeArn(entry.arn);
    if (normalizedArn && matchedArnKeys.has(normalizedArn)) continue;
    if (entry.tfType && entry.id && matchedIdKeys.has(`${entry.tfType}:${normalizeId(entry.id)}`)) continue;

    if (region) {
      const entryRegion = regionFromArn(entry.arn);
      if (entryRegion && entryRegion !== "global" && entryRegion !== region) continue;
    }

    if (!DISCOVERABLE_TF_TYPES.has(entry.tfType)) {
      subResources.push(entry);
    } else {
      staleStateResources.push(entry);
    }
  }

  return { managed, unmanaged, staleStateResources, subResources };
}

module.exports = { parseTfstate, buildTfstateIndex, compareTfstate };
