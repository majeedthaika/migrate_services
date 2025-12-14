import { useState } from 'react';
import { ArrowRight, CheckSquare, Square, AlertCircle, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';

export function SelectMappingsStep() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMappings, setExpandedMappings] = useState<Set<string>>(new Set());

  const {
    entityMappings,
    selectedMappingKeys,
    setSelectedMappingKeys,
    toggleMappingSelection,
    selectedSourceSchemaKeys,
  } = useMigrationStore();

  // Filter mappings to only show those where ALL source schemas are selected
  // This includes the primary source and any additional sources for multi-source joins
  const availableMappings = entityMappings.filter((mapping) => {
    // Check primary source
    const primarySourceKey = `${mapping.source_service}.${mapping.source_entity}`;
    if (!selectedSourceSchemaKeys.includes(primarySourceKey)) {
      return false;
    }

    // Check additional sources (for multi-source joins)
    if (mapping.additional_sources && mapping.additional_sources.length > 0) {
      const allAdditionalSourcesSelected = mapping.additional_sources.every((src) => {
        const additionalKey = `${src.service}.${src.entity}`;
        return selectedSourceSchemaKeys.includes(additionalKey);
      });
      if (!allAdditionalSourcesSelected) {
        return false;
      }
    }

    return true;
  });

  // Further filter by search query
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

  // Helper function to check if all sources for a mapping are selected
  const areAllSourcesSelected = (mapping: typeof entityMappings[0]) => {
    const primarySourceKey = `${mapping.source_service}.${mapping.source_entity}`;
    if (!selectedSourceSchemaKeys.includes(primarySourceKey)) {
      return false;
    }
    if (mapping.additional_sources && mapping.additional_sources.length > 0) {
      return mapping.additional_sources.every((src) => {
        const additionalKey = `${src.service}.${src.entity}`;
        return selectedSourceSchemaKeys.includes(additionalKey);
      });
    }
    return true;
  };

  // Get indices of filtered mappings in the original array
  const filteredMappingIndices = entityMappings
    .map((mapping, index) => {
      if (!areAllSourcesSelected(mapping)) return -1;
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
  const selectedMappings = entityMappings.filter((_, index) =>
    selectedMappingKeys.includes(`mapping-${index}`)
  );
  const targetEntities = [...new Set(
    selectedMappings.map(m => `${m.target_service}.${m.target_entity}`)
  )];

  if (selectedSourceSchemaKeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            No source schemas selected. Please go back and select at least one source schema.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (availableMappings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            No mappings available for the selected source schemas.
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
            Create mappings in the Mappings tab that use: {selectedSourceSchemaKeys.join(', ')}
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
