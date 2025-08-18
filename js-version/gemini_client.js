import { GoogleGenAI } from "@google/genai";

// Generation config with function declaration
const config = {
  tools: [
    {
      functionDeclarations: [get_],
    },
  ],
};

// Configure the client
const ai = new GoogleGenAI({});

// Define user prompt
const contents = [
  {
    role: "user",
    parts: [{ text: "l" }],
  },
];

// Send request with function declarations
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: contents,
  config: config,
});

console.log(response.functionCalls[0]);
