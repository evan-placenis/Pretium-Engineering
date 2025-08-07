Frontend → API Route → Job Queue → Edge Function → AI Processing → Database

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Pretium Engineering Report Generator

A comprehensive engineering report generation system that processes site inspection photos and generates professional reports.

## Features

- **Multi-Executor Support**: Choose from different execution strategies for report generation
- **Real-time Streaming**: Live progress updates during report generation
- **Image Analysis**: AI-powered analysis of inspection photos
- **Knowledge Integration**: Connect reports to project specifications and requirements
- **Enhanced Chatbot**: AI-powered chat assistant for report editing and questions
- **AWS Lambda Deployment**: Scalable serverless architecture

## Environment Variables

### Required for Report Generation

- `GROK_API_KEY` - API key for Grok AI (used for report generation)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Required for Enhanced Chatbot

- `GROK_API_KEY` - API key for Grok AI (used for chatbot functionality)

### Optional

- `AWS_ACCESS_KEY_ID` - AWS access key for Lambda deployment
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for Lambda deployment
- `AWS_REGION` - AWS region for Lambda deployment

## Enhanced Chatbot Features

The enhanced chatbot now supports:

### "@" Reference System

Use "@" to make explicit references to specific content in your report:

- `@section 1.1` or `@1.1` - Reference to section 1.1
- `@roofing` - Reference to any content containing "roofing"
- `@image 5` or `@[IMAGE:5]` - Reference to image 5
- `@group HVAC` - Reference to HVAC group content
- `@first paragraph` - Reference to the first paragraph
- `@last bullet` - Reference to the last bullet point

### Examples

- "Change @section 1.1 to be more detailed"
- "Remove @image 3 from the report"
- "Add a new section after @roofing"
- "Make @first paragraph more professional"

### Agent Types

The chatbot automatically determines which agent to use:

- **Knowledge Agent**: For questions about specifications, codes, and requirements
- **Modification Agent**: For making changes to the report (automatically selected when using "@" references)
- **Assistant Agent**: For general questions and help

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Deploy to AWS Lambda: `npm run deploy`
5. Start the development server: `npm run dev`

## Deployment

### AWS Lambda Deployment

```bash
npm run deploy
```

### Local Development

```bash
npm run dev
```

## Architecture

- **Frontend**: Next.js with TypeScript
- **Backend**: AWS Lambda functions
- **Database**: Supabase (PostgreSQL)
- **AI**: Grok AI for report generation and chatbot
- **Storage**: Supabase Storage for images

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
