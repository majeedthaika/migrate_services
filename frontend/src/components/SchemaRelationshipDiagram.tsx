import { useState, useMemo } from 'react';
import { useMigrationStore } from '@/store/migration';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { EntitySchema, SchemaRelationship } from '@/types/migration';

interface EntityNode {
  entity: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DiagramProps {
  service: string;
  schemas: EntitySchema[];
  relationships: SchemaRelationship[];
  hoveredRelationship: SchemaRelationship | null;
  setHoveredRelationship: (rel: SchemaRelationship | null) => void;
  isExpanded: boolean;
  mousePos: { x: number; y: number };
  setMousePos: (pos: { x: number; y: number }) => void;
}


function ServiceDiagram({ service, schemas, relationships, hoveredRelationship, setHoveredRelationship, isExpanded, setMousePos }: DiagramProps) {
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Get all entities related to the selected entity
  const relatedToSelected = useMemo(() => {
    if (!selectedEntity) return new Set<string>();
    const related = new Set<string>();
    related.add(selectedEntity);
    relationships.forEach(rel => {
      if (rel.from === selectedEntity) related.add(rel.to);
      if (rel.to === selectedEntity) related.add(rel.from);
    });
    return related;
  }, [selectedEntity, relationships]);

  // Check if a relationship involves the selected entity
  const isRelationshipSelected = (rel: SchemaRelationship) => {
    if (!selectedEntity) return false;
    return rel.from === selectedEntity || rel.to === selectedEntity;
  };

  // Calculate entity positions in a compact grid layout
  const entityNodes = useMemo(() => {
    const nodes: Record<string, EntityNode> = {};
    const entityNames = schemas.map(s => s.entity);
    const count = entityNames.length;

    if (count === 0) return nodes;

    // Smaller sizes for compact diagram
    const nodeWidth = 90;
    const nodeHeight = 28;
    const horizontalGap = 24;
    const verticalGap = 40;

    // Find root entities (entities that are only "from" in relationships, not "to")
    const toEntities = new Set(relationships.map(r => r.to));
    const fromEntities = new Set(relationships.map(r => r.from));

    // Categorize entities by level
    const roots = entityNames.filter(e => fromEntities.has(e) && !toEntities.has(e));
    const leaves = entityNames.filter(e => toEntities.has(e) && !fromEntities.has(e));
    const middle = entityNames.filter(e => !roots.includes(e) && !leaves.includes(e));

    // Build levels with max 4 per row for compactness
    const levels: string[][] = [];
    const maxPerRow = 5;

    if (roots.length === 0) {
      for (let i = 0; i < count; i += maxPerRow) {
        levels.push(entityNames.slice(i, i + maxPerRow));
      }
    } else {
      // Split large levels into multiple rows
      const splitLevel = (arr: string[]) => {
        const result: string[][] = [];
        for (let i = 0; i < arr.length; i += maxPerRow) {
          result.push(arr.slice(i, i + maxPerRow));
        }
        return result;
      };

      if (roots.length > 0) levels.push(...splitLevel(roots));
      if (middle.length > 0) levels.push(...splitLevel(middle));
      if (leaves.length > 0) levels.push(...splitLevel(leaves));
    }

    const svgWidth = 500;

    levels.forEach((level, rowIndex) => {
      const rowWidth = level.length * nodeWidth + (level.length - 1) * horizontalGap;
      const rowStartX = (svgWidth - rowWidth) / 2;

      level.forEach((entity, colIndex) => {
        nodes[entity] = {
          entity,
          x: rowStartX + colIndex * (nodeWidth + horizontalGap),
          y: 20 + rowIndex * (nodeHeight + verticalGap),
          width: nodeWidth,
          height: nodeHeight,
        };
      });
    });

    return nodes;
  }, [schemas, relationships]);

  // Get connection points for relationship lines
  const getConnectionPath = (rel: SchemaRelationship) => {
    const from = entityNodes[rel.from];
    const to = entityNodes[rel.to];

    if (!from || !to) return null;

    const fromCenterX = from.x + from.width / 2;
    const fromCenterY = from.y + from.height / 2;
    const toCenterX = to.x + to.width / 2;
    const toCenterY = to.y + to.height / 2;

    let fromX = fromCenterX;
    let fromY = from.y + from.height;
    let toX = toCenterX;
    let toY = to.y;

    if (Math.abs(from.y - to.y) < 15) {
      if (from.x < to.x) {
        fromX = from.x + from.width;
        fromY = fromCenterY;
        toX = to.x;
        toY = toCenterY;
      } else {
        fromX = from.x;
        fromY = fromCenterY;
        toX = to.x + to.width;
        toY = toCenterY;
      }
    } else if (from.y > to.y) {
      fromY = from.y;
      toY = to.y + to.height;
    }

    const midY = (fromY + toY) / 2;

    return {
      path: `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`,
      from: { x: fromX, y: fromY },
      to: { x: toX, y: toY },
    };
  };

  // Service colors - modern palette
  const serviceColors: Record<string, { border: string }> = {
    stripe: { border: '#635bff' },      // Stripe purple
    chargebee: { border: '#ff6b35' },   // Chargebee orange
    salesforce: { border: '#00a1e0' },  // Salesforce blue
  };

  const colors = serviceColors[service] || { border: '#6b7280' };

  // Calculate diagram height based on nodes
  const maxY = Math.max(...Object.values(entityNodes).map(n => n.y + n.height), 100);

  return (
    <svg
      width="100%"
      viewBox={`0 0 500 ${maxY + 30}`}
      className="w-full"
      style={{
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        maxHeight: isExpanded ? 'none' : '180px',
        height: isExpanded ? 'auto' : undefined,
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Background - click to deselect */}
      <rect
        width="100%"
        height="100%"
        fill="hsl(var(--card))"
        rx="4"
        onClick={() => setSelectedEntity(null)}
        className="cursor-default"
      />

      {/* Draw relationships first (behind nodes) */}
      {relationships.map((rel, i) => {
        const pathData = getConnectionPath(rel);
        if (!pathData) return null;

        const isHovered = hoveredRelationship === rel ||
          hoveredEntity === rel.from ||
          hoveredEntity === rel.to;
        const isSelected = isRelationshipSelected(rel);
        const isDimmed = selectedEntity && !isSelected;
        const highlight = isHovered || isSelected;

        const lineColor = rel.type === 'one_to_one' ? '#3b82f6' :
          rel.type === 'one_to_many' ? '#10b981' : '#8b5cf6';

        return (
          <g
            key={`${rel.from}-${rel.to}-${i}`}
            onMouseEnter={() => setHoveredRelationship(rel)}
            onMouseLeave={() => setHoveredRelationship(null)}
            className="cursor-pointer"
          >
            <path
              d={pathData.path}
              fill="none"
              stroke={lineColor}
              strokeWidth={highlight ? 2.5 : 1.5}
              strokeDasharray={rel.type === 'many_to_many' ? '4,3' : 'none'}
              opacity={isDimmed ? 0.15 : highlight ? 1 : 0.5}
              className="transition-all duration-200"
            />
            <circle
              cx={pathData.to.x}
              cy={pathData.to.y}
              r={highlight ? 4 : 3}
              fill={lineColor}
              opacity={isDimmed ? 0.15 : highlight ? 1 : 0.6}
              className="transition-all duration-200"
            />
            <path
              d={pathData.path}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
            />
          </g>
        );
      })}

      {/* Draw entity nodes */}
      {Object.values(entityNodes).map((node) => {
        const isHovered = hoveredEntity === node.entity;
        const isRelated = hoveredRelationship?.from === node.entity || hoveredRelationship?.to === node.entity;
        const isEntitySelected = selectedEntity === node.entity;
        const isConnectedToSelected = relatedToSelected.has(node.entity);
        const isDimmed = selectedEntity && !isConnectedToSelected;
        const highlight = isHovered || isRelated || isEntitySelected;

        return (
          <g
            key={node.entity}
            onMouseEnter={() => setHoveredEntity(node.entity)}
            onMouseLeave={() => setHoveredEntity(null)}
            onClick={() => setSelectedEntity(selectedEntity === node.entity ? null : node.entity)}
            className="cursor-pointer"
            style={{ filter: highlight && !isDimmed ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none' }}
          >
            {/* Main box */}
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx="6"
              fill={highlight ? colors.border : 'hsl(var(--card))'}
              stroke={highlight ? colors.border : 'hsl(var(--border))'}
              strokeWidth={isEntitySelected ? 2 : 1}
              opacity={isDimmed ? 0.25 : 1}
              className="transition-all duration-200"
            />
            {/* Accent bar on left */}
            <rect
              x={node.x}
              y={node.y}
              width="3"
              height={node.height}
              rx="1.5"
              fill={colors.border}
              opacity={isDimmed ? 0.25 : highlight ? 1 : 0.7}
              className="transition-all duration-200"
            />
            {/* Selection indicator */}
            {isEntitySelected && (
              <circle
                cx={node.x + node.width - 8}
                cy={node.y + 8}
                r="3"
                fill={highlight ? 'white' : colors.border}
                opacity="0.9"
              />
            )}
            <text
              x={node.x + node.width / 2 + 2}
              y={node.y + node.height / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={highlight ? 'white' : 'hsl(var(--foreground))'}
              fontSize={node.entity.length > 10 ? 9 : 10}
              fontWeight="500"
              opacity={isDimmed ? 0.3 : 1}
              className="select-none transition-all duration-200"
            >
              {node.entity.length > 12 ? node.entity.slice(0, 11) + '…' : node.entity}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SchemaRelationshipDiagram() {
  const { availableSchemas, schemaRelationships } = useMigrationStore();
  const [selectedService, setSelectedService] = useState<string>('stripe');
  const [hoveredRelationship, setHoveredRelationship] = useState<SchemaRelationship | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const schemasByService = useMemo(() => {
    return availableSchemas.reduce((acc, schema) => {
      if (!acc[schema.service]) {
        acc[schema.service] = [];
      }
      acc[schema.service].push(schema);
      return acc;
    }, {} as Record<string, EntitySchema[]>);
  }, [availableSchemas]);

  const services = Object.keys(schemasByService);
  const currentSchemas = schemasByService[selectedService] || [];
  const currentRelationships = schemaRelationships[selectedService] || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" />
            </svg>
            Entity Relationships
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-[hsl(var(--muted))] p-0.5 rounded-md">
              {services.map((service) => (
                <button
                  key={service}
                  onClick={() => setSelectedService(service)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all capitalize ${
                    selectedService === service
                      ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-[hsl(var(--muted))] transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              >
                {isExpanded ? (
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                ) : (
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 relative">
        {/* Diagram */}
        {currentSchemas.length > 0 ? (
          <ServiceDiagram
            service={selectedService}
            schemas={currentSchemas}
            relationships={currentRelationships}
            hoveredRelationship={hoveredRelationship}
            setHoveredRelationship={setHoveredRelationship}
            isExpanded={isExpanded}
            mousePos={mousePos}
            setMousePos={setMousePos}
          />
        ) : (
          <div className="text-center py-6 text-[hsl(var(--muted-foreground))] text-sm">
            No schemas available for {selectedService}
          </div>
        )}

        {/* Floating tooltip */}
        {hoveredRelationship && (
          <div
            className="absolute z-10 p-2 rounded-lg text-xs border bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-lg pointer-events-none max-w-[220px]"
            style={{
              left: Math.min(mousePos.x + 12, 280),
              top: mousePos.y - 60,
            }}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold">{hoveredRelationship.from}</span>
              <svg width="12" height="8" viewBox="0 0 14 8">
                <path d="M0 4 L10 4 M7 1 L12 4 L7 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="font-semibold">{hoveredRelationship.to}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                hoveredRelationship.type === 'one_to_one' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                hoveredRelationship.type === 'one_to_many' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {hoveredRelationship.type.replace(/_/g, ':')}
              </span>
            </div>
            {hoveredRelationship.foreign_key && (
              <div className="mt-1 text-[hsl(var(--muted-foreground))]">
                Key: <code className="bg-[hsl(var(--muted))] px-1 rounded text-[10px]">{hoveredRelationship.foreign_key}</code>
              </div>
            )}
            {hoveredRelationship.description && (
              <p className="text-[hsl(var(--muted-foreground))] mt-1 leading-tight">{hoveredRelationship.description}</p>
            )}
          </div>
        )}

        {/* Legend - at bottom */}
        <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-4 text-[10px] text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-1.5">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="14" y2="3" stroke="#3b82f6" strokeWidth="1.5" />
              <circle cx="16" cy="3" r="2" fill="#3b82f6" />
            </svg>
            <span>1:1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="14" y2="3" stroke="#10b981" strokeWidth="1.5" />
              <circle cx="16" cy="3" r="2" fill="#10b981" />
            </svg>
            <span>1:N</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="18" height="6" viewBox="0 0 18 6">
              <line x1="0" y1="3" x2="14" y2="3" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3,2" />
              <circle cx="16" cy="3" r="2" fill="#8b5cf6" />
            </svg>
            <span>N:M</span>
          </div>
          <span className="ml-auto text-[hsl(var(--muted-foreground))]">Click to select, hover for details</span>
        </div>
      </CardContent>
    </Card>
  );
}
