import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  number: number;
  title: string;
  description: string;
}

interface StepperProgressProps {
  steps: Step[];
  currentStep: number;
}

export function StepperProgress({ steps, currentStep }: StepperProgressProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <li key={step.number} className="relative flex flex-1 flex-col items-center">
              {/* Connector line */}
              {index !== 0 && (
                <div
                  className={cn(
                    'absolute left-0 top-4 h-0.5 w-full -translate-x-1/2',
                    isCompleted || isCurrent
                      ? 'bg-[hsl(var(--primary))]'
                      : 'bg-[hsl(var(--border))]'
                  )}
                  style={{ width: 'calc(100% - 2rem)' }}
                />
              )}

              {/* Step circle */}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  isCompleted && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
                  isCurrent &&
                    'border-2 border-[hsl(var(--primary))] bg-[hsl(var(--background))] text-[hsl(var(--primary))] ring-4 ring-[hsl(var(--primary))]/20',
                  !isCompleted &&
                    !isCurrent &&
                    'border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.number}
              </div>

              {/* Step info */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:block">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
