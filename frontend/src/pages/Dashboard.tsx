import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Clock, CheckCircle, XCircle, Loader2, Trash2, Play, Database, GitBranch, ChevronDown, ChevronRight, ArrowRight, Edit2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { migrationAPI } from '@/lib/api';
import { useMigrationStore } from '@/store/migration';
import type { Migration, EntitySchema, FieldSchema } from '@/types/migration';
import { formatDate, getStatusColor } from '@/lib/utils';

// Collapsible schema viewer
function SchemaCard({ schema }: { schema: EntitySchema }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[hsl(var(--muted))] transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-xs uppercase text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-2 py-0.5 rounded">
            {schema.service}
          </span>
          <span className="font-medium">{schema.entity}</span>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {schema.fields.length} fields
        </span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 bg-[hsl(var(--muted))]/50 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[hsl(var(--muted-foreground))] uppercase">
                <th className="text-left py-1">Field</th>
                <th className="text-left py-1">Type</th>
                <th className="text-left py-1">Required</th>
              </tr>
            </thead>
            <tbody>
              {schema.fields.map((field: FieldSchema) => (
                <tr key={field.name} className="border-t border-[hsl(var(--border))]/50">
                  <td className="py-1 font-mono text-xs">{field.name}</td>
                  <td className="py-1 text-[hsl(var(--muted-foreground))]">{field.type}</td>
                  <td className="py-1">
                    {field.required && <span className="text-[hsl(var(--destructive))]">*</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Mapping summary card
function MappingCard({ mapping }: { mapping: { source_service: string; source_entity: string; target_service: string; target_entity: string; field_mappings: Array<{ source_field: string; target_field: string; transform: string }> } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[hsl(var(--muted))] transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{mapping.source_service}.{mapping.source_entity}</span>
          <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="font-medium text-[hsl(var(--primary))]">{mapping.target_service}.{mapping.target_entity}</span>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {mapping.field_mappings.length} fields
        </span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 bg-[hsl(var(--muted))]/50 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[hsl(var(--muted-foreground))] uppercase">
                <th className="text-left py-1">Source</th>
                <th className="text-left py-1"></th>
                <th className="text-left py-1">Target</th>
                <th className="text-left py-1">Transform</th>
              </tr>
            </thead>
            <tbody>
              {mapping.field_mappings.map((fm, idx) => (
                <tr key={idx} className="border-t border-[hsl(var(--border))]/50">
                  <td className="py-1 font-mono text-xs">{fm.source_field}</td>
                  <td className="py-1 text-[hsl(var(--muted-foreground))]">→</td>
                  <td className="py-1 font-mono text-xs">{fm.target_field}</td>
                  <td className="py-1">
                    <Badge variant="outline" className="text-xs">{fm.transform}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);

  // Get schemas and mappings from store
  const { sourceSchemas, targetSchema, entityMappings, setActiveTab } = useMigrationStore();

  const loadMigrations = async () => {
    setLoading(true);
    const res = await migrationAPI.list();
    if (res.data) {
      setMigrations(res.data.migrations);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMigrations();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this migration?')) return;

    const res = await migrationAPI.delete(id);
    if (!res.error) {
      setMigrations((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'extracting':
      case 'transforming':
      case 'validating':
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Stats
  const stats = {
    total: migrations.length,
    completed: migrations.filter((m) => m.status === 'completed').length,
    failed: migrations.filter((m) => m.status === 'failed').length,
    running: migrations.filter((m) =>
      ['extracting', 'transforming', 'validating', 'loading'].includes(m.status)
    ).length,
  };

  // Group source schemas by service
  const schemasByService = sourceSchemas.reduce((acc, schema) => {
    if (!acc[schema.service]) acc[schema.service] = [];
    acc[schema.service].push(schema);
    return acc;
  }, {} as Record<string, EntitySchema[]>);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Migrate Services</h1>
            <p className="text-[hsl(var(--muted-foreground))]">
              Manage schemas, mappings, and run data migrations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/workspace">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Migration
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column: Schemas & Mappings */}
          <div className="col-span-2 space-y-6">
            {/* Source Schemas */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Source Schemas
                  </CardTitle>
                  <Link to="/workspace" onClick={() => setActiveTab('schemas')}>
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {sourceSchemas.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
                    No source schemas defined
                  </p>
                ) : (
                  Object.entries(schemasByService).map(([service, schemas]) => (
                    <div key={service} className="space-y-2">
                      {schemas.map((schema) => (
                        <SchemaCard key={`${schema.service}-${schema.entity}`} schema={schema} />
                      ))}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Target Schema */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4 text-[hsl(var(--primary))]" />
                    Target Schema
                  </CardTitle>
                  <Link to="/workspace" onClick={() => setActiveTab('schemas')}>
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {targetSchema ? (
                  <SchemaCard schema={targetSchema} />
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
                    No target schema defined
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Mappings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Field Mappings
                  </CardTitle>
                  <Link to="/workspace" onClick={() => setActiveTab('mappings')}>
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {entityMappings.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
                    No mappings defined
                  </p>
                ) : (
                  entityMappings.map((mapping, idx) => (
                    <MappingCard key={idx} mapping={mapping} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Migration History & Stats */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-3">
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Migrations</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xl font-bold text-green-500">{stats.completed}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xl font-bold text-blue-500">{stats.running}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Running</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-xl font-bold text-red-500">{stats.failed}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Failed</p>
                </CardContent>
              </Card>
            </div>

            {/* Migration History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Migration History</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : migrations.length === 0 ? (
                  <div className="text-center py-8">
                    <Play className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">No migrations yet</p>
                    <Link to="/workspace" className="mt-2 inline-block">
                      <Button size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        New Migration
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {migrations.map((migration) => (
                      <div
                        key={migration.id}
                        className="flex items-center justify-between p-2 rounded border hover:bg-[hsl(var(--muted))] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getStatusIcon(migration.status)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{migration.name}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              {formatDate(migration.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(migration.status)} text-xs`}>
                            {migration.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-[hsl(var(--destructive))]"
                            onClick={() => handleDelete(migration.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
