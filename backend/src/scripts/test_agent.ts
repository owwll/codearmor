import dotenv from "dotenv";
import { ArmorIQClient } from "@armoriq/sdk";
dotenv.config();
const AGENT_ID = "66cfa558-4b57-4328-80e5-9f1a850ba008";
const API_KEY = process.env.ARMORIQ_API_KEY;

// async function testAgent() {
//     try {
//         const response = await axios.get(
//             `https://api.armoriq.ai/agent/agents/66cfa558-4b57-4328-80e5-9f1a850ba008`,
//             {
//                 headers: {
//                     Authorization: `Bearer ${API_KEY}`,
//                 },
//             }
//         );
//         console.log("Status:", response.status);
//         console.log("Content-Type:", response.headers["content-type"]);
//         console.log(response.data);
//     } catch (error) {
//         console.error("Test Failed:", error);
//     }
// }

// testAgent();

async function main() {
    const client = new ArmorIQClient({
        apiKey: process.env.ARMORIQ_API_KEY!,
        userId: "codearmor-test",
        agentId: "66cfa558-4b57-4328-80e5-9f1a850ba008",
    });

    const plan = await client.capturePlan(
        "gpt-4o",
        "Analyze a repository",
        {
            goal: "Analyze repository security",
            steps: [
                {
                    action: "scan_repo",
                    mcp: "github-mcp",
                    params: {
                        repo: "https://github.com/owwll/AI-Powerd-TextGen.git",
                    },
                },
            ],
        }
    );

    console.log("PLAN:");
    console.log(plan);

    const token = await client.getIntentToken(plan);

    console.log("TOKEN:");
    console.log(token);
}

main();