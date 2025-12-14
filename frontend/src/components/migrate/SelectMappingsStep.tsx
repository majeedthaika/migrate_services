import { ArrowRight, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';

export function SelectMappingsStep() {
  const {
    entityMappings,
    selectedMappingKeys,
    setSelectedMappingKeys,
    toggleMappingSelection,
    selectedSourceSchemaKeys,
  } = useMigrationStore();

  // Filter mappings to only show those where the source entity is in selectedSourceSchemaKeys
  const availableMappings = entityMappings.filter((mapping) => {
    const sourceKey = `${mapping.source_service}.${mapping.source_entity}`;
    return selectedSourceSchemaKeys.includes(sourceKey);
  });

  // Get indices of available mappings in the original array
  const availableMappingIndices = entityMappings
    .map((mapping, index) => {
      const sourceKey = `${mapping.source_service}.${mapping.source_entity}`;
      return selectedSourceSchemaKeys.includes(sourceKey) ? index : -1;
    })
    .filter(index => index !== -1);

  const allSelected = availableMappings.length > 0 &&
    availableMappingIndices.every(index => selectedMappingKeys.includes(`mapping-${index}`));
  const noneSelected = selectedMappingKeys.length === 0;

  const handleSelectAll = () => {
    setSelectedMappingKeys(availableMappingIndices.map(index => `mapping-${index}`));
  };

  const handleDeselectAll = () => {
    setSelectedMappingKeys([]);
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select Entity Mappings to Run</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected}
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
        </CardHeader>
        <CardContent className="space-y-2">
          {availableMappings.map((mapping) => {
            // Find the original index in entityMappings
            const originalIndex = entityMappings.findIndex(
              m => m.source_service === mapping.source_service &&
                   m.source_entity === mapping.source_entity &&
                   m.target_service === mapping.target_service &&
                   m.target_entity === mapping.target_entity
            );
            const key = `mapping-${originalIndex}`;
            const isSelected = selectedMappingKeys.includes(key);
            const fieldCount = mapping.field_mappings.length;

            return (
              <button
                key={key}
                onClick={() => toggleMappingSelection(key)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                  isSelected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                {isSelected ? (
                  <CheckSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
                ) : (
                  <Square className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                )}
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {mapping.source_service}.{mapping.source_entity}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <span className="font-medium text-[hsl(var(--primary))]">
                      {mapping.target_service}.{mapping.target_entity}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                  {fieldCount} field {fieldCount === 1 ? 'mapping' : 'mappings'}
                </div>
              </button>
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
