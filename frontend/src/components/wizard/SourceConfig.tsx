import { useState } from 'react';
import { Plus, Trash2, Database, FileSpreadsheet, Camera, Globe } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import type { DataSource, DataSourceType } from '@/types/migration';

const SOURCE_TYPES: { value: DataSourceType; label: string; icon: typeof Database }[] = [
  { value: 'api', label: 'API', icon: Database },
  { value: 'csv', label: 'CSV File', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON File', icon: FileSpreadsheet },
  { value: 'screenshot', label: 'Screenshot', icon: Camera },
  { value: 'web_scrape', label: 'Web Scrape', icon: Globe },
];

const SERVICES = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'chargebee', label: 'Chargebee' },
  { value: 'custom', label: 'Custom' },
];

const ENTITIES: Record<string, { value: string; label: string }[]> = {
  stripe: [
    { value: 'Customer', label: 'Customer' },
    { value: 'Subscription', label: 'Subscription' },
    { value: 'Invoice', label: 'Invoice' },
  ],
  salesforce: [
    { value: 'Account', label: 'Account' },
    { value: 'Contact', label: 'Contact' },
    { value: 'Lead', label: 'Lead' },
  ],
  chargebee: [
    { value: 'Customer', label: 'Customer' },
    { value: 'Subscription', label: 'Subscription' },
  ],
  custom: [{ value: 'custom', label: 'Custom Entity' }],
};

interface SourceFormProps {
  source: DataSource;
  index: number;
  onUpdate: (source: DataSource) => void;
  onRemove: () => void;
}

function SourceForm({ source, index, onUpdate, onRemove }: SourceFormProps) {
  const SourceIcon = SOURCE_TYPES.find((t) => t.value === source.type)?.icon || Database;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SourceIcon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <CardTitle className="text-base">Source {index + 1}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-8 w-8 p-0 text-[hsl(var(--destructive))]">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Source Type"
            options={SOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            value={source.type}
            onChange={(e) => onUpdate({ ...source, type: e.target.value as DataSourceType })}
          />
          <Input
            label="Name"
            value={source.name}
            onChange={(e) => onUpdate({ ...source, name: e.target.value })}
            placeholder="e.g., stripe_customers"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Service"
            options={SERVICES}
            value={source.service}
            onChange={(e) => onUpdate({ ...source, service: e.target.value, entity: '' })}
            placeholder="Select service"
          />
          <Select
            label="Entity"
            options={ENTITIES[source.service] || []}
            value={source.entity}
            onChange={(e) => onUpdate({ ...source, entity: e.target.value })}
            placeholder="Select entity"
            disabled={!source.service}
          />
        </div>

        {/* API-specific fields */}
        {source.type === 'api' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="API Key"
              type="password"
              value={source.api_key || ''}
              onChange={(e) => onUpdate({ ...source, api_key: e.target.value })}
              placeholder="Enter API key"
            />
            <Input
              label="API Endpoint (optional)"
              value={source.api_endpoint || ''}
              onChange={(e) => onUpdate({ ...source, api_endpoint: e.target.value })}
              placeholder="https://api.example.com"
            />
          </div>
        )}

        {/* File-specific fields */}
        {(source.type === 'csv' || source.type === 'json') && (
          <Input
            label="File Path"
            value={source.file_path || ''}
            onChange={(e) => onUpdate({ ...source, file_path: e.target.value })}
            placeholder="./data/customers.csv"
          />
        )}

        {/* Web scrape fields */}
        {source.type === 'web_scrape' && (
          <>
            <Input
              label="URL"
              value={source.url || ''}
              onChange={(e) => onUpdate({ ...source, url: e.target.value })}
              placeholder="https://app.example.com/records"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium">Browser Instructions</label>
              <textarea
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                rows={3}
                value={source.browser_instructions || ''}
                onChange={(e) => onUpdate({ ...source, browser_instructions: e.target.value })}
                placeholder="1. Log in with credentials&#10;2. Navigate to Records page&#10;3. Export visible table data"
              />
            </div>
          </>
        )}

        {/* Screenshot fields */}
        {source.type === 'screenshot' && (
          <Input
            label="Screenshot Path"
            value={source.screenshot_path || ''}
            onChange={(e) => onUpdate({ ...source, screenshot_path: e.target.value })}
            placeholder="./data/screenshots/"
          />
        )}

        {/* Common options */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Batch Size"
            type="number"
            value={source.batch_size}
            onChange={(e) => onUpdate({ ...source, batch_size: parseInt(e.target.value) || 100 })}
          />
          <Input
            label="Rate Limit (req/s)"
            type="number"
            value={source.rate_limit || ''}
            onChange={(e) =>
              onUpdate({ ...source, rate_limit: e.target.value ? parseFloat(e.target.value) : undefined })
            }
            placeholder="Optional"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function SourceConfig() {
  const { name, setName, description, setDescription, sources, addSource, updateSource, removeSource } =
    useMigrationStore();

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddSource = () => {
    const newSource: DataSource = {
      type: 'api',
      name: '',
      service: '',
      entity: '',
      batch_size: 100,
      filters: {},
    };
    addSource(newSource);
  };

  // Validation is handled by the wizard navigation
  const _validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Migration name is required';
    }

    if (sources.length === 0) {
      newErrors.sources = 'At least one source is required';
    }

    sources.forEach((source, index) => {
      if (!source.name.trim()) {
        newErrors[`source_${index}_name`] = 'Source name is required';
      }
      if (!source.service) {
        newErrors[`source_${index}_service`] = 'Service is required';
      }
      if (!source.entity) {
        newErrors[`source_${index}_entity`] = 'Entity is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  void _validate;

  return (
    <div className="space-y-6">
      {/* Migration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Migration Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Stripe to Chargebee Migration"
            error={errors.name}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this migration"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Data Sources</h3>
          <Button variant="outline" size="sm" onClick={handleAddSource}>
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        </div>

        {errors.sources && (
          <p className="text-sm text-[hsl(var(--destructive))]">{errors.sources}</p>
        )}

        {sources.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Database className="mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No sources configured. Add a source to get started.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddSource}>
                <Plus className="mr-2 h-4 w-4" />
                Add Source
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sources.map((source, index) => (
              <SourceForm
                key={index}
                source={source}
                index={index}
                onUpdate={(updated) => updateSource(index, updated)}
                onRemove={() => removeSource(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
