import { create } from 'zustand';
import type { DataSource, EntityMapping, ProgressEvent } from '@/types/migration';

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface MigrationWizardState {
  // Current wizard step
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;

  // Migration configuration
  name: string;
  setName: (name: string) => void;

  description: string;
  setDescription: (description: string) => void;

  // Sources
  sources: DataSource[];
  addSource: (source: DataSource) => void;
  updateSource: (index: number, source: DataSource) => void;
  removeSource: (index: number) => void;

  // Target
  targetService: string;
  setTargetService: (service: string) => void;

  targetSite: string;
  setTargetSite: (site: string) => void;

  targetApiKey: string;
  setTargetApiKey: (key: string) => void;

  // Mappings
  entityMappings: EntityMapping[];
  setEntityMappings: (mappings: EntityMapping[]) => void;
  addEntityMapping: (mapping: EntityMapping) => void;
  updateEntityMapping: (index: number, mapping: EntityMapping) => void;
  removeEntityMapping: (index: number) => void;

  // Execution options
  dryRun: boolean;
  setDryRun: (dryRun: boolean) => void;

  batchSize: number;
  setBatchSize: (size: number) => void;

  // Migration ID (after creation)
  migrationId: string | null;
  setMigrationId: (id: string | null) => void;

  // Progress tracking
  progress: ProgressEvent | null;
  setProgress: (progress: ProgressEvent | null) => void;

  // Sample data for preview
  sampleData: Record<string, unknown>[];
  setSampleData: (data: Record<string, unknown>[]) => void;

  // Reset wizard
  reset: () => void;
}

const initialState = {
  currentStep: 1 as WizardStep,
  name: '',
  description: '',
  sources: [] as DataSource[],
  targetService: '',
  targetSite: '',
  targetApiKey: '',
  entityMappings: [] as EntityMapping[],
  dryRun: true,
  batchSize: 100,
  migrationId: null as string | null,
  progress: null as ProgressEvent | null,
  sampleData: [] as Record<string, unknown>[],
};

export const useMigrationStore = create<MigrationWizardState>((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),

  setName: (name) => set({ name }),
  setDescription: (description) => set({ description }),

  addSource: (source) =>
    set((state) => ({ sources: [...state.sources, source] })),
  updateSource: (index, source) =>
    set((state) => ({
      sources: state.sources.map((s, i) => (i === index ? source : s)),
    })),
  removeSource: (index) =>
    set((state) => ({
      sources: state.sources.filter((_, i) => i !== index),
    })),

  setTargetService: (targetService) => set({ targetService }),
  setTargetSite: (targetSite) => set({ targetSite }),
  setTargetApiKey: (targetApiKey) => set({ targetApiKey }),

  setEntityMappings: (entityMappings) => set({ entityMappings }),
  addEntityMapping: (mapping) =>
    set((state) => ({ entityMappings: [...state.entityMappings, mapping] })),
  updateEntityMapping: (index, mapping) =>
    set((state) => ({
      entityMappings: state.entityMappings.map((m, i) =>
        i === index ? mapping : m
      ),
    })),
  removeEntityMapping: (index) =>
    set((state) => ({
      entityMappings: state.entityMappings.filter((_, i) => i !== index),
    })),

  setDryRun: (dryRun) => set({ dryRun }),
  setBatchSize: (batchSize) => set({ batchSize }),

  setMigrationId: (migrationId) => set({ migrationId }),
  setProgress: (progress) => set({ progress }),
  setSampleData: (sampleData) => set({ sampleData }),

  reset: () => set(initialState),
}));
