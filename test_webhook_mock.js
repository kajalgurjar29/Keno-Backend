import axios from 'axios';

async function testWebhook() {
    const payload = {
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: {
            object: {
                id: "cs_test_b1FQZhYLRyqhpZzHyPFmsQr2cLQdO1VtAVZofXYHRrj7I73fE1WOLZx5jF",
                mode: "subscription",
                customer: "cus_test_123",
                subscription: "sub_test_123",
                metadata: {
                    userId: "69a97e0c65aa0df002996396",
                    plan: "monthly"
                }
            }
        }
    };

    try {
        console.log("Sending mock webhook to http://localhost:3000/api/v1/stripe/webhook ...");
        const response = await axios.post('http://localhost:3000/api/v1/stripe/webhook', payload, {
            headers: {
                'stripe-signature': 'mock',
                'Content-Type': 'application/json'
            }
        });
        console.log("Response:", response.data);
    } catch (err) {
        console.error("Error:", err.response?.data || err.message);
    }
}

testWebhook();
