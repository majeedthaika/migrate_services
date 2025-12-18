import { useState, useMemo } from 'react';
import { ArrowRight, CheckSquare, Square, AlertCircle, Search, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import {
  computeUploadOrder,
  getOverridablePrerequisites,
  getEntityDependencies,
} from '@/lib/uploadOrder';

export function SelectMappingsStep() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMappings, setExpandedMappings] = useState<Set<string>>(new Set());

  const {
    entityMappings,
    selectedMappingKeys,
    setSelectedMappingKeys,
    toggleMappingSelection,
    schemaRelationships,
    targetService,
    overriddenPrerequisites,
    togglePrerequisiteOverride,
  } = useMigrationStore();

  // Get target relationships for dependency calculation
  const targetRelationships = schemaRelationships[targetService] || [];

  // All mappings are available (no schema filtering)
  const availableMappings = entityMappings;

  // Filter by search query
  const filteredMappings = availableMappings.filter((mapping) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      mapping.source_service.toLowerCase().includes(query) ||
      mapping.source_entity.toLowerCase().includes(query) ||
      mapping.target_service.toLowerCase().includes(query) ||
      mapping.target_entity.toLowerCase().includes(query) ||
      mapping.field_mappings.some(fm =>
        fm.source_field.toLowerCase().includes(query) ||
        fm.target_field.toLowerCase().includes(query) ||
        fm.transform.toLowerCase().includes(query)
      )
    );
  });

  // Get indices of filtered mappings in the original array
  const filteredMappingIndices = entityMappings
    .map((mapping, index) => {
      if (!searchQuery) return index;
      const query = searchQuery.toLowerCase();
      const matches =
        mapping.source_service.toLowerCase().includes(query) ||
        mapping.source_entity.toLowerCase().includes(query) ||
        mapping.target_service.toLowerCase().includes(query) ||
        mapping.target_entity.toLowerCase().includes(query) ||
        mapping.field_mappings.some(fm =>
          fm.source_field.toLowerCase().includes(query) ||
          fm.target_field.toLowerCase().includes(query) ||
          fm.transform.toLowerCase().includes(query)
        );
      return matches ? index : -1;
    })
    .filter(index => index !== -1);

  // Compute selected mappings and their dependencies
  const selectedMappings = useMemo(() =>
    entityMappings.filter((_, index) =>
      selectedMappingKeys.includes(`mapping-${index}`)
    ),
    [entityMappings, selectedMappingKeys]
  );

  // Compute upload order for preview
  const uploadOrder = useMemo(() =>
    computeUploadOrder(
      selectedMappings,
      entityMappings,
      targetRelationships,
      new Set(), // No completed entities yet
      overriddenPrerequisites
    ),
    [selectedMappings, entityMappings, targetRelationships, overriddenPrerequisites]
  );

  // Get overridable prerequisites (entities not selected but required)
  const overridablePrereqs = useMemo(() =>
    getOverridablePrerequisites(selectedMappings, targetRelationships),
    [selectedMappings, targetRelationships]
  );

  // Get dependencies for each mapping's target entity
  const getDependencyInfo = (mapping: typeof entityMappings[0]) => {
    const selectedTargetEntities = selectedMappings.map(m => m.target_entity);
    return getEntityDependencies(
      mapping.target_entity,
      targetRelationships,
      selectedTargetEntities
    );
  };

  const allSelected = filteredMappings.length > 0 &&
    filteredMappingIndices.every(index => selectedMappingKeys.includes(`mapping-${index}`));
  const noneSelected = selectedMappingKeys.length === 0;

  const handleSelectAll = () => {
    const filteredKeys = filteredMappingIndices.map(index => `mapping-${index}`);
    const existingKeys = selectedMappingKeys.filter(
      key => !filteredMappingIndices.some(idx => `mapping-${idx}` === key)
    );
    setSelectedMappingKeys([...existingKeys, ...filteredKeys]);
  };

  const handleDeselectAll = () => {
    if (searchQuery) {
      // Only deselect filtered mappings
      const filteredKeys = filteredMappingIndices.map(idx => `mapping-${idx}`);
      setSelectedMappingKeys(
        selectedMappingKeys.filter(key => !filteredKeys.includes(key))
      );
    } else {
      setSelectedMappingKeys([]);
    }
  };

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedMappings);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMappings(newExpanded);
  };

  // Get unique target entities that will be generated
  const targetEntities = [...new Set(
    selectedMappings.map(m => `${m.target_service}.${m.target_entity}`)
  )];

  if (availableMappings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            No mappings available. Create mappings in the Mappings tab first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select Entity Mappings to Run</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected || filteredMappings.length === 0}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                disabled={noneSelected}
              >
                Deselect All
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search mappings by entity, service, or field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredMappings.length === 0 && searchQuery && (
            <div className="py-8 text-center text-[hsl(var(--muted-foreground))]">
              No mappings match "{searchQuery}"
            </div>
          )}
          {filteredMappings.map((mapping) => {
            // Find the original index in entityMappings
            const originalIndex = entityMappings.findIndex(
              m => m.source_service === mapping.source_service &&
                   m.source_entity === mapping.source_entity &&
                   m.target_service === mapping.target_service &&
                   m.target_entity === mapping.target_entity
            );
            const key = `mapping-${originalIndex}`;
            const isSelected = selectedMappingKeys.includes(key);
            const isExpanded = expandedMappings.has(key);
            const fieldCount = mapping.field_mappings.length;

            // Get dependency information for this mapping
            const depInfo = getDependencyInfo(mapping);
            const hasMissingDeps = depInfo.missing.length > 0;
            const hasSelectedDeps = depInfo.selected.length > 0;
            const allDepsOverridden = depInfo.missing.every(d => overriddenPrerequisites.has(d));

            return (
              <div
                key={key}
                className={`rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                    : 'border-[hsl(var(--border))]'
                }`}
              >
                <button
                  onClick={() => toggleMappingSelection(key)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-[hsl(var(--muted))]/50"
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-[hsl(var(--primary))] flex-shrink-0" />
                  ) : (
                    <Square className="h-5 w-5 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium">
                          {mapping.source_service}.{mapping.source_entity}
                        </span>
                        {mapping.additional_sources && mapping.additional_sources.length > 0 && (
                          <>
                            {mapping.additional_sources.map((src, idx) => (
                              <span key={idx} className="font-medium">
                                <span className="text-[hsl(var(--muted-foreground))]"> + </span>
                                {src.service}.{src.entity}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                      <span className="font-medium text-[hsl(var(--primary))]">
                        {mapping.target_service}.{mapping.target_entity}
                      </span>
                      {/* Dependency indicator */}
                      {(hasMissingDeps || hasSelectedDeps) && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          hasMissingDeps && !allDepsOverridden
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                        }`}>
                          {hasMissingDeps && !allDepsOverridden ? (
                            <>Requires: {depInfo.missing.join(', ')}</>
                          ) : hasSelectedDeps ? (
                            <>After: {depInfo.selected.join(', ')}</>
                          ) : null}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                      {fieldCount} field {fieldCount === 1 ? 'mapping' : 'mappings'}
                      {mapping.additional_sources && mapping.additional_sources.length > 0 && (
                        <span> from {1 + mapping.additional_sources.length} sources</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(key);
                    }}
                    className="p-1 hover:bg-[hsl(var(--muted))] rounded flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </button>
                </button>

                {/* Expanded field mappings details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[hsl(var(--border))]">
                    <div className="mt-3">
                      {/* Column headers */}
                      <div className="grid grid-cols-[minmax(200px,2fr)_24px_minmax(200px,2fr)_100px] gap-3 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2 px-2">
                        <span>Source Field</span>
                        <span></span>
                        <span className="text-[hsl(var(--primary))]">{mapping.target_service}.{mapping.target_entity}</span>
                        <span className="text-right">Transform</span>
                      </div>
                      <div className="space-y-1">
                        {mapping.field_mappings.map((fm, idx) => {
                          // Determine source schema - use field-level override or default to primary
                          const sourceSchema = fm.source_service && fm.source_entity
                            ? `${fm.source_service}.${fm.source_entity}`
                            : `${mapping.source_service}.${mapping.source_entity}`;
                          const hasMultipleSources = mapping.additional_sources && mapping.additional_sources.length > 0;

                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-[minmax(200px,2fr)_24px_minmax(200px,2fr)_100px] gap-3 items-center text-sm py-1.5 px-2 rounded bg-[hsl(var(--muted))]/50"
                            >
                              <div className="min-w-0">
                                {hasMultipleSources && (
                                  <span className="text-xs text-[hsl(var(--muted-foreground))] block truncate">
                                    {sourceSchema}
                                  </span>
                                )}
                                <span className="font-mono text-[hsl(var(--muted-foreground))] block truncate">
                                  {fm.source_field}
                                </span>
                              </div>
                              <div className="flex justify-center">
                                <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                              </div>
                              <span className="font-mono font-medium truncate min-w-0">
                                {fm.target_field}
                              </span>
                              <div className="text-right">
                                {fm.transform !== 'direct' ? (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] inline-block">
                                    {fm.transform}
                                  </span>
                                ) : (
                                  <span className="text-xs text-[hsl(var(--muted-foreground))]">direct</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Upload Order Preview */}
      {selectedMappingKeys.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Upload Order</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex items-center gap-2 flex-wrap">
              {uploadOrder.map((item, index) => (
                <div key={item.targetEntity} className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-sm rounded border ${
                    item.dependencyStatus === 'ready' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' :
                    item.dependencyStatus === 'overridden' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' :
                    item.dependencyStatus === 'waiting' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]' :
                    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}>
                    {index + 1}. {item.targetEntity}
                  </span>
                  {index < uploadOrder.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Override Prerequisites */}
      {overridablePrereqs.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Missing Prerequisites
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
              The following entities are required but not selected. If they already exist in {targetService}, check them to override:
            </p>
            <div className="space-y-2">
              {overridablePrereqs.map(entity => (
                <button
                  key={entity}
                  onClick={() => togglePrerequisiteOverride(entity)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors w-full text-left ${
                    overriddenPrerequisites.has(entity)
                      ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'border-amber-500/30 bg-[hsl(var(--background))] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  {overriddenPrerequisites.has(entity) ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Square className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="font-medium">{entity}</span>
                  {overriddenPrerequisites.has(entity) && (
                    <span className="text-xs text-green-500 ml-auto">Already exists in target</span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {selectedMappingKeys.length > 0 && (
        <Card className="bg-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {selectedMappingKeys.length} mapping{selectedMappingKeys.length === 1 ? '' : 's'} selected
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Will generate: {targetEntities.join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
