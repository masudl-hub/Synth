import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are an expert composer and synthesizer programmer.
Your goal is to create a 'SynthPatch' based on the user's description, image analysis, or refinement request.
The response must be valid JSON.

CRITICAL RULES:
1. Frequency ('freq') MUST be a number in Hz (e.g., 440, 110). DO NOT use note names like "C4".
2. 'startStep' must be an integer between 0 and totalSteps-1.
3. 'durationSteps' must be an integer 1-8.
4. Melody and Bassline MUST be substantial. Create variation between the first and second half of the loop.
5. Use 'delay' and 'reverb' to add space and dimension.
6. Think about musical structure (Call and Response, A/B sections) before generating.
7. SONIC VARIETY: Do NOT default to basic "Sine" + "Lowpass". Use Sawtooth/Square waves. Use Filter Resonance (Q > 5).
8. FM SYNTHESIS: Use 'fmAmount' aggressively (30-90) to create metallic, bell-like, or gritty textures.
9. SCALES: Use exotic scales (Phrygian, Lydian, Dorian) or chromaticism. Avoid plain Major scales unless requested.
10. DYNAMICS: Vary the envelope. Use short plucks, long swells, and percussive hits.
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    bpm: { type: Type.NUMBER },
    totalSteps: { type: Type.NUMBER },
    oscillator: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["sine", "square", "sawtooth", "triangle"] },
        detune: { type: Type.NUMBER },
        fmAmount: { type: Type.NUMBER }
      },
      required: ["type", "detune", "fmAmount"]
    },
    filter: {
      type: Type.OBJECT,
      properties: {
        frequency: { type: Type.NUMBER },
        q: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ["lowpass", "highpass", "bandpass"] }
      },
      required: ["frequency", "q", "type"]
    },
    envelope: {
      type: Type.OBJECT,
      properties: {
        attack: { type: Type.NUMBER },
        decay: { type: Type.NUMBER },
        sustain: { type: Type.NUMBER },
        release: { type: Type.NUMBER }
      },
      required: ["attack", "decay", "sustain", "release"]
    },
    delay: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.NUMBER },
        feedback: { type: Type.NUMBER },
        mix: { type: Type.NUMBER }
      },
      required: ["time", "feedback", "mix"]
    },
    reverb: {
      type: Type.OBJECT,
      properties: {
        decay: { type: Type.NUMBER },
        mix: { type: Type.NUMBER }
      },
      required: ["decay", "mix"]
    },
    melody: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          freq: { type: Type.NUMBER },
          startStep: { type: Type.NUMBER },
          durationSteps: { type: Type.NUMBER }
        },
        required: ["freq", "startStep", "durationSteps"]
      }
    },
    bassline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          freq: { type: Type.NUMBER },
          startStep: { type: Type.NUMBER },
          durationSteps: { type: Type.NUMBER }
        },
        required: ["freq", "startStep", "durationSteps"]
      }
    }
  },
  required: ["name", "description", "bpm", "oscillator", "filter", "envelope", "melody", "bassline"]
};

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required to generate sounds.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with a 10MB limit (for base64 images)
  app.use(express.json({ limit: "10mb" }));

  // API Routes FIRST
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, loopLength, imageBase64, currentPatch } = req.body;
      if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
      }

      const ai = getAIClient();

      let finalPrompt = prompt;
      const structureHint = loopLength >= 64 
          ? ` Create a long, evolving structure (${loopLength} steps). Use A/B sections.` 
          : ` Create a concise ${loopLength}-step loop.`;
      
      finalPrompt += structureHint;
      finalPrompt += ` Ensure the 'totalSteps' property is set to ${loopLength}.`;
      
      // Contextual Refinement Logic
      let promptContent: any[] = [];
      
      if (imageBase64) {
          // Multimodal: Image + Text
          const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));
          const base64Data = imageBase64.split(',')[1];
          
          promptContent = [
              { text: `Analyze this image. Translate its visual mood, texture, and composition into a SynthPatch. ${finalPrompt}` },
              { inlineData: { mimeType, data: base64Data } }
          ];
      } else {
          // Text Only or Refinement
          if (currentPatch && !prompt.toLowerCase().includes("scratch")) {
              promptContent = [{
                  text: `Current Patch State: ${JSON.stringify(currentPatch)}. 
                  User Request: "${finalPrompt}". 
                  Modify the current patch state to match the request. Keep what works, change what needs changing.`
              }];
          } else {
              promptContent = [{ text: finalPrompt }];
          }
      }

      const result = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: {
              parts: promptContent
          },
          config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: responseSchema,
              temperature: 1.5,
              topP: 0.95,
              thinkingConfig: { thinkingBudget: 4096 }
          }
      });

      const jsonText = result.text;
      if (!jsonText) {
          throw new Error("No response returned from the model.");
      }

      const patch = JSON.parse(jsonText);
      res.json(patch);

    } catch (error: any) {
      console.error("Error in sound generation:", error);
      res.status(500).json({ error: error?.message || "Failed to generate patch" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
