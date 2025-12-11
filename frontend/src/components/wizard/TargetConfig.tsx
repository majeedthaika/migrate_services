import { Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';

const TARGET_SERVICES = [
  { value: 'chargebee', label: 'Chargebee' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'custom', label: 'Custom API' },
];

export function TargetConfig() {
  const {
    targetService,
    setTargetService,
    targetSite,
    setTargetSite,
    targetApiKey,
    setTargetApiKey,
    dryRun,
    setDryRun,
    batchSize,
    setBatchSize,
  } = useMigrationStore();

  return (
    <div className="space-y-6">
      {/* Target Service */}
      <Card>
        <CardHeader>
          <CardTitle>Target Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Target Service"
            options={TARGET_SERVICES}
            value={targetService}
            onChange={(e) => setTargetService(e.target.value)}
            placeholder="Select target service"
          />

          {targetService === 'chargebee' && (
            <Input
              label="Site Name"
              value={targetSite}
              onChange={(e) => setTargetSite(e.target.value)}
              placeholder="your-site"
            />
          )}

          {targetService === 'custom' && (
            <Input
              label="API Base URL"
              value={targetSite}
              onChange={(e) => setTargetSite(e.target.value)}
              placeholder="https://api.example.com"
            />
          )}

          <Input
            label="API Key"
            type="password"
            value={targetApiKey}
            onChange={(e) => setTargetApiKey(e.target.value)}
            placeholder="Enter API key"
          />
        </CardContent>
      </Card>

      {/* Execution Options */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="dry-run"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-[hsl(var(--input))]"
            />
            <label htmlFor="dry-run" className="text-sm">
              <span className="font-medium">Dry Run Mode</span>
              <p className="text-[hsl(var(--muted-foreground))]">
                Test the migration without making actual changes to the target
              </p>
            </label>
          </div>

          <Input
            label="Batch Size"
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
            placeholder="100"
          />
        </CardContent>
      </Card>

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {targetService && targetApiKey ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm">Ready to connect to {targetService}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                Configure target service and API key to continue
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
