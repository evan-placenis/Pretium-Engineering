# Report Generator System

A flexible, decorator-pattern-based report generation system that allows runtime configuration of models, modes, execution strategies, and grouping.

## 🎯 Key Features

- **Runtime Configuration**: Pick model, mode, execution strategy, and grouping at runtime
- **Decorator Pattern**: Easy to mix and match different configurations
- **Parallel & Sequential Execution**: Choose execution strategy based on your needs
- **Grouped & Ungrouped Modes**: Support for both organizational approaches
- **Multiple LLM Providers**: Grok4 and GPT-4o support
- **Extensible**: Easy to add new models, modes, or strategies

## 🏗️ Architecture

```
ReportGenerator
├── LLM Providers (Grok4Provider, GPT4oProvider)
├── Execution Strategies (ParallelExecutor, SequentialExecutor)
├── Prompt Strategies (BriefPromptStrategy, ElaboratePromptStrategy)
└── Configuration Helpers (predefined configs)
```

## 📋 Configuration Options

### Models

- `grok4`: Grok4 API integration
- `gpt4o`: OpenAI GPT-4o integration

### Modes

- `brief`: Concise, focused reports
- `elaborate`: Comprehensive, detailed reports

### Execution Strategies

- `parallel`: Process images simultaneously (faster)
- `sequential`: Process images one by one (more reliable)

### Grouping Modes

- `grouped`: Organize by image groups/sections
- `ungrouped`: AI Chronological organization

## 🚀 Usage Examples

### Predefined Configurations

```typescript
// Fast brief report (ungrouped, parallel, Grok4)
ReportGenerator.fastBrief();

// Comprehensive detailed report (grouped, sequential, GPT-4o)
ReportGenerator.comprehensiveDetailed();

// Brief grouped report with Grok4
ReportGenerator.briefGroupedGrok4();

// Elaborate ungrouped report with GPT-4o
ReportGenerator.elaborateUngroupedGPT4o();
```

### Custom Configuration

```typescript
// Custom mix of settings
ReportGenerator.custom("brief", "gpt4o", "parallel", "grouped");
```

### Runtime Configuration

```typescript
const generator = new ReportGenerator();

const result = await generator.generateReport({
  ...ReportGenerator.custom(
    userPreferences.mode, // 'brief' | 'elaborate'
    userPreferences.model, // 'grok4' | 'gpt4o'
    userPreferences.execution, // 'parallel' | 'sequential'
    userPreferences.grouping // 'grouped' | 'ungrouped'
  ),
  images: [
    /* your images */
  ],
  bulletPoints: "Generate a technical report",
  projectData: { name: "Project", location: "Location" },
});
```

## 🔧 Integration with Existing System

Replace the MCP system with this simpler approach:

```typescript
// In your job processing function
async function processJobWithNewGenerator(job: any) {
  const generator = new ReportGenerator();

  // Map job type to configuration
  let config;
  switch (job.job_type) {
    case "generate_report_mcp_brief":
      config = job.input_data.isUngroupedMode
        ? ReportGenerator.fastBrief()
        : ReportGenerator.briefGroupedGrok4();
      break;
    case "generate_report_mcp_elaborate":
      config = job.input_data.isUngroupedMode
        ? ReportGenerator.elaborateUngroupedGPT4o()
        : ReportGenerator.comprehensiveDetailed();
      break;
    default:
      config = ReportGenerator.fastBrief();
  }

  const result = await generator.generateReport({
    ...config,
    images: job.input_data.imagesWithNumbering,
    bulletPoints: job.input_data.bulletPoints,
    projectData: job.input_data.projectData,
    options: {
      contractName: job.input_data.contractName,
      location: job.input_data.location,
      groupOrder: job.input_data.groupOrder,
    },
  });

  return result;
}
```

## 🎨 Benefits Over MCP

1. **Simpler**: No complex agent orchestration
2. **More Flexible**: Easy to mix and match configurations
3. **Easier to Maintain**: Clear separation of concerns
4. **Better Performance**: Direct LLM calls without agent overhead
5. **Runtime Configuration**: Build the right agent at runtime based on user preferences

## 📁 File Structure

```
report-generation/
├── ReportGenerator.ts          # Main orchestrator
├── types.ts                    # TypeScript interfaces
├── llm/
│   ├── Grok4Provider.ts        # Grok4 API integration
│   └── GPT4oProvider.ts        # OpenAI API integration
├── execution/
│   ├── ParallelExecutor.ts     # Parallel processing strategy
│   └── SequentialExecutor.ts   # Sequential processing strategy
├── prompts/
│   ├── BriefPromptStrategy.ts  # Brief mode prompts
│   └── ElaboratePromptStrategy.ts # Elaborate mode prompts
├── example-usage.ts            # Usage examples
└── README.md                   # This file
```

## 🔄 Migration from MCP

1. Replace `MCPRunner` with `ReportGenerator`
2. Map existing job types to new configurations
3. Update prompt references to use new prompt strategies
4. Remove MCP agent files (optional)

The new system is much simpler and more flexible while providing the same functionality!
