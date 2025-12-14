import { useState } from 'react';
import { CheckSquare, Square, Database, Search, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';

export function SelectSchemasStep() {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    sourceSchemas,
    selectedSourceSchemaKeys,
    setSelectedSourceSchemaKeys,
    toggleSourceSchemaSelection,
  } = useMigrationStore();

  // Filter schemas based on search query
  const filteredSchemas = sourceSchemas.filter((schema) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      schema.service.toLowerCase().includes(query) ||
      schema.entity.toLowerCase().includes(query) ||
      schema.description?.toLowerCase().includes(query) ||
      schema.fields.some(f => f.name.toLowerCase().includes(query))
    );
  });

  const allSelected = filteredSchemas.length > 0 &&
    filteredSchemas.every((s) => selectedSourceSchemaKeys.includes(`${s.service}.${s.entity}`));
  const noneSelected = selectedSourceSchemaKeys.length === 0;

  const handleSelectAll = () => {
    const filteredKeys = filteredSchemas.map((s) => `${s.service}.${s.entity}`);
    const existingKeys = selectedSourceSchemaKeys.filter(
      key => !filteredSchemas.some(s => `${s.service}.${s.entity}` === key)
    );
    setSelectedSourceSchemaKeys([...existingKeys, ...filteredKeys]);
  };

  const handleDeselectAll = () => {
    if (searchQuery) {
      // Only deselect filtered schemas
      const filteredKeys = filteredSchemas.map((s) => `${s.service}.${s.entity}`);
      setSelectedSourceSchemaKeys(
        selectedSourceSchemaKeys.filter(key => !filteredKeys.includes(key))
      );
    } else {
      setSelectedSourceSchemaKeys([]);
    }
  };

  // Group schemas by service
  const schemasByService = filteredSchemas.reduce((acc, schema) => {
    if (!acc[schema.service]) {
      acc[schema.service] = [];
    }
    acc[schema.service].push(schema);
    return acc;
  }, {} as Record<string, typeof sourceSchemas>);

  if (sourceSchemas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">
            No source schemas configured. Please create schemas in the Schemas tab first.
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
            <CardTitle className="text-base">Select Source Schemas to Migrate</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected || filteredSchemas.length === 0}
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
              placeholder="Search schemas by name, service, or field..."
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
        <CardContent className="space-y-6">
          {filteredSchemas.length === 0 && searchQuery && (
            <div className="py-8 text-center text-[hsl(var(--muted-foreground))]">
              No schemas match "{searchQuery}"
            </div>
          )}
          {Object.entries(schemasByService).map(([service, schemas]) => (
            <div key={service}>
              <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                {service}
              </h3>
              <div className="space-y-2">
                {schemas.map((schema) => {
                  const key = `${schema.service}.${schema.entity}`;
                  const isSelected = selectedSourceSchemaKeys.includes(key);
                  const fieldCount = schema.fields.length;

                  return (
                    <button
                      key={key}
                      onClick={() => toggleSourceSchemaSelection(key)}
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
                      <Database className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                      <div className="flex-1">
                        <span className="font-medium">{schema.entity}</span>
                        {schema.description && (
                          <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {schema.description}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-[hsl(var(--muted-foreground))]">
                        {fieldCount} field{fieldCount === 1 ? '' : 's'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedSourceSchemaKeys.length > 0 && (
        <Card className="bg-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/20">
          <CardContent className="py-4">
            <p className="font-medium">
              {selectedSourceSchemaKeys.length} schema{selectedSourceSchemaKeys.length === 1 ? '' : 's'} selected
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {selectedSourceSchemaKeys.join(', ')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
