import axios from "axios";

const AGENT_ID = "66cfa558-4b57-4328-80e5-9f1a850ba008";
const API_KEY = process.env.ARMORIQ_API_KEY;

async function testAgent() {
    try {
        const response = await axios.get(
            `https://platform.armoriq.ai/api/v1/agents/${AGENT_ID}`,
            {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                },
            }
        );
        console.log("Status:", response.status);
        console.log("Content-Type:", response.headers["content-type"]);
        console.log(response.data);
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testAgent();