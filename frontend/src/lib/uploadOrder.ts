/**
 * Utility functions for computing the correct upload order based on
 * target entity relationships and dependencies.
 */

import type { EntityMapping, SchemaRelationship } from '@/types/migration';

export interface UploadOrderItem {
  targetEntity: string;
  targetService: string;
  mappingIndex: number;
  mapping: EntityMapping;
  dependencies: string[];
  dependencyStatus: 'ready' | 'waiting' | 'missing' | 'overridden';
}

export interface DependencyOverride {
  entity: string;
  reason?: string; // Optional reason e.g., "Uploaded in previous run"
}

/**
 * Build a dependency graph from relationships.
 * For one_to_many relationships, the "from" entity must be created before "to".
 * e.g., Customer -> Subscription means Customer must exist before Subscription.
 */
function buildDependencyGraph(
  relationships: SchemaRelationship[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const rel of relationships) {
    // one_to_many: "from" is the parent, "to" is the child that depends on parent
    // The child (to) depends on the parent (from) existing first
    if (rel.type === 'one_to_many' || rel.type === 'one_to_one') {
      const deps = graph.get(rel.to) || [];
      if (!deps.includes(rel.from)) {
        deps.push(rel.from);
      }
      graph.set(rel.to, deps);

      // Ensure parent entity exists in graph (even with no deps)
      if (!graph.has(rel.from)) {
        graph.set(rel.from, []);
      }
    }
  }

  return graph;
}

/**
 * Perform topological sort using Kahn's algorithm.
 * Returns entities in the order they should be uploaded.
 */
function topologicalSort(
  entities: string[],
  dependencyGraph: Map<string, string[]>
): string[] {
  // Build in-degree count for each entity
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const entity of entities) {
    inDegree.set(entity, 0);
    adjacency.set(entity, []);
  }

  // Build adjacency and in-degree
  for (const entity of entities) {
    const deps = dependencyGraph.get(entity) || [];
    for (const dep of deps) {
      if (entities.includes(dep)) {
        // dep -> entity (dep must come before entity)
        const adj = adjacency.get(dep) || [];
        adj.push(entity);
        adjacency.set(dep, adj);
        inDegree.set(entity, (inDegree.get(entity) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  // Start with entities that have no dependencies (in-degree 0)
  for (const [entity, degree] of inDegree) {
    if (degree === 0) {
      queue.push(entity);
    }
  }

  // Sort queue alphabetically for deterministic order
  queue.sort();

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        // Insert in sorted position for deterministic order
        const insertIdx = queue.findIndex(q => q > neighbor);
        if (insertIdx === -1) {
          queue.push(neighbor);
        } else {
          queue.splice(insertIdx, 0, neighbor);
        }
      }
    }
  }

  // Check for cycles (if result doesn't contain all entities)
  if (result.length !== entities.length) {
    console.warn('Dependency cycle detected, some entities may be in wrong order');
    // Add remaining entities at the end
    for (const entity of entities) {
      if (!result.includes(entity)) {
        result.push(entity);
      }
    }
  }

  return result;
}

/**
 * Compute the upload order for selected mappings based on target entity relationships.
 *
 * @param selectedMappings - The entity mappings that were selected for migration
 * @param allMappings - All available entity mappings (to get indices)
 * @param targetRelationships - Relationships for the target service
 * @param completedEntities - Set of entity names that have already been uploaded
 * @param overriddenEntities - Set of entity names where dependencies are manually overridden (pre-existing in target)
 * @returns Ordered list of upload items with dependency information
 */
export function computeUploadOrder(
  selectedMappings: EntityMapping[],
  allMappings: EntityMapping[],
  targetRelationships: SchemaRelationship[],
  completedEntities: Set<string> = new Set(),
  overriddenEntities: Set<string> = new Set()
): UploadOrderItem[] {
  if (selectedMappings.length === 0) {
    return [];
  }

  // Build dependency graph from target relationships
  const dependencyGraph = buildDependencyGraph(targetRelationships);

  // Get unique target entities from selected mappings
  const targetEntities = [...new Set(
    selectedMappings.map(m => m.target_entity)
  )];

  // Sort by dependencies
  const sortedEntities = topologicalSort(targetEntities, dependencyGraph);

  // Build result with dependency info
  const result: UploadOrderItem[] = [];
  const selectedEntitiesSet = new Set(targetEntities);

  for (const entity of sortedEntities) {
    // Find the mapping for this entity
    const mapping = selectedMappings.find(m => m.target_entity === entity);
    if (!mapping) continue;

    // Find original index in allMappings
    const mappingIndex = allMappings.findIndex(
      m => m.source_service === mapping.source_service &&
           m.source_entity === mapping.source_entity &&
           m.target_service === mapping.target_service &&
           m.target_entity === mapping.target_entity
    );

    // Get dependencies for this entity
    const allDeps = dependencyGraph.get(entity) || [];
    const relevantDeps = allDeps.filter(dep => selectedEntitiesSet.has(dep));

    // Determine dependency status
    let dependencyStatus: 'ready' | 'waiting' | 'missing' | 'overridden';

    // Check if this entity's dependencies are overridden (user said they already exist)
    const hasOverriddenDeps = allDeps.some(dep => overriddenEntities.has(dep));

    if (relevantDeps.length === 0) {
      dependencyStatus = 'ready';
    } else {
      // Check deps considering both completed entities and overridden entities
      const missingDeps = relevantDeps.filter(
        dep => !completedEntities.has(dep) && !overriddenEntities.has(dep)
      );

      if (missingDeps.length === 0) {
        // All dependencies are either completed or overridden
        dependencyStatus = hasOverriddenDeps ? 'overridden' : 'ready';
      } else {
        // Check if any missing deps are not in selected mappings (truly missing)
        const unselectedDeps = allDeps.filter(
          dep => !selectedEntitiesSet.has(dep) && !overriddenEntities.has(dep)
        );
        if (unselectedDeps.length > 0) {
          dependencyStatus = 'missing';
        } else {
          dependencyStatus = 'waiting';
        }
      }
    }

    result.push({
      targetEntity: entity,
      targetService: mapping.target_service,
      mappingIndex,
      mapping,
      dependencies: relevantDeps,
      dependencyStatus,
    });
  }

  return result;
}

/**
 * Get the dependencies for a specific target entity.
 * Returns both selected and unselected (missing) dependencies.
 */
export function getEntityDependencies(
  targetEntity: string,
  targetRelationships: SchemaRelationship[],
  selectedTargetEntities: string[]
): { selected: string[]; missing: string[] } {
  const dependencyGraph = buildDependencyGraph(targetRelationships);
  const allDeps = dependencyGraph.get(targetEntity) || [];
  const selectedSet = new Set(selectedTargetEntities);

  const selected = allDeps.filter(dep => selectedSet.has(dep));
  const missing = allDeps.filter(dep => !selectedSet.has(dep));

  return { selected, missing };
}

/**
 * Check if selecting a mapping would create a missing dependency warning.
 */
export function hasMissingDependencies(
  mapping: EntityMapping,
  selectedMappings: EntityMapping[],
  targetRelationships: SchemaRelationship[]
): string[] {
  const dependencyGraph = buildDependencyGraph(targetRelationships);
  const allDeps = dependencyGraph.get(mapping.target_entity) || [];

  const selectedTargetEntities = new Set(
    selectedMappings.map(m => m.target_entity)
  );

  // Check which dependencies are not selected
  return allDeps.filter(dep => !selectedTargetEntities.has(dep));
}

/**
 * Get all required source schemas from selected mappings.
 * This replaces the manual schema selection step.
 */
export function getRequiredSourceSchemas(
  selectedMappings: EntityMapping[]
): { service: string; entity: string }[] {
  const schemas: { service: string; entity: string }[] = [];
  const seen = new Set<string>();

  for (const mapping of selectedMappings) {
    // Add primary source
    const primaryKey = `${mapping.source_service}.${mapping.source_entity}`;
    if (!seen.has(primaryKey)) {
      seen.add(primaryKey);
      schemas.push({
        service: mapping.source_service,
        entity: mapping.source_entity,
      });
    }

    // Add additional sources (for multi-source joins)
    if (mapping.additional_sources) {
      for (const src of mapping.additional_sources) {
        const key = `${src.service}.${src.entity}`;
        if (!seen.has(key)) {
          seen.add(key);
          schemas.push({
            service: src.service,
            entity: src.entity,
          });
        }
      }
    }
  }

  return schemas;
}

/**
 * Get all entities that could be overridden as prerequisites.
 * These are entities that are dependencies of selected mappings but are not themselves selected.
 * The user might have already uploaded these in a previous run.
 */
export function getOverridablePrerequisites(
  selectedMappings: EntityMapping[],
  targetRelationships: SchemaRelationship[]
): string[] {
  const dependencyGraph = buildDependencyGraph(targetRelationships);
  const selectedTargetEntities = new Set(
    selectedMappings.map(m => m.target_entity)
  );

  const overridable = new Set<string>();

  for (const entity of selectedTargetEntities) {
    const deps = dependencyGraph.get(entity) || [];
    for (const dep of deps) {
      // If this dependency is not selected, it could be overridden
      if (!selectedTargetEntities.has(dep)) {
        overridable.add(dep);
      }
    }
  }

  return Array.from(overridable).sort();
}
