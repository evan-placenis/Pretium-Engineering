"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var trigger_processor_exports = {};
__export(trigger_processor_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(trigger_processor_exports);
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
var handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "ok"
    };
  }
  try {
    const processJobsFunctionUrl = process.env.PROCESS_JOBS_FUNCTION_URL;
    if (!processJobsFunctionUrl) {
      throw new Error("Missing PROCESS_JOBS_FUNCTION_URL environment variable");
    }
    console.log("\u{1F680} Triggering job processor...");
    try {
      const response = await fetch(processJobsFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        console.log("\u2705 Job processor triggered successfully");
      } else {
        console.error("\u274C Job processor returned error status:", response.status);
      }
    } catch (error) {
      console.error("\u274C Trigger failed:", error);
    }
    console.log("\u2705 Trigger request sent");
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: "Job processor triggered successfully"
      })
    };
  } catch (error) {
    console.error("Error in job processor trigger:", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
