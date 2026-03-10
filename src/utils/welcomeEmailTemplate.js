/**
 * Generates the HTML content for the Welcome Email
 * @param {string} userName - The name of the user
 * @returns {string} - HTML Email Template
 */
export const getWelcomeEmailTemplate = (userName) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Punt Data</title>
        <style>
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #2D3748;
                margin: 0;
                padding: 0;
                background-color: #F7FAFC;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }
            .header {
                background: linear-gradient(135deg, #1A365D 0%, #2B6CB0 100%);
                padding: 40px 20px;
                text-align: center;
                color: #ffffff;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 800;
                letter-spacing: -0.5px;
            }
            .content {
                padding: 30px;
            }
            .greeting {
                font-size: 20px;
                font-weight: 700;
                color: #1A365D;
                margin-bottom: 20px;
            }
            .section-title {
                font-size: 18px;
                font-weight: 700;
                color: #2B6CB0;
                margin-top: 30px;
                margin-bottom: 15px;
                border-bottom: 2px solid #E2E8F0;
                padding-bottom: 5px;
            }
            .highlight-box {
                background-color: #EBF8FF;
                border-left: 4px solid #3182CE;
                padding: 15px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
            }
            .list-item {
                margin-bottom: 10px;
                display: flex;
                align-items: flex-start;
            }
            .list-item-icon {
                color: #3182CE;
                margin-right: 10px;
                font-weight: bold;
            }
            .footer {
                background-color: #EDF2F7;
                padding: 25px;
                text-align: center;
                font-size: 12px;
                color: #718096;
            }
            .footer a {
                color: #3182CE;
                text-decoration: none;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #3182CE;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin-top: 20px;
            }
            .small-text {
                font-size: 13px;
                color: #718096;
            }
            .bold {
                font-weight: 600;
                color: #1A365D;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Punt Data</h1>
                <p style="margin-top: 10px; opacity: 0.9;">Smarter Decisions Through Better Data</p>
            </div>
            <div class="content">
                <div class="greeting">Welcome to Punt Data, ${userName}!</div>
                
                <p>Thanks for joining Punt Data — an independent data platform built for punters who want clearer insight and better context when betting on Trackside Virtual Racing and Keno. Think of it as your historic <span class="bold">“Form Guide”</span> for Trackside and Keno.</p>
                
                <div class="highlight-box">
                    <p style="margin: 0;">You’re starting with a <span class="bold">1-week free trial*</span>, giving you full access to all features so you can explore the data and see how it works for you.</p>
                </div>

                <div class="section-title">What is Punt Data?</div>
                <p>Punt Data analyses published historical results only to highlight patterns, trends, and behaviours that emerge over time.</p>
                <p>There are no tips, no predictions, and no guarantees. Instead, we turn large volumes of past results into practical insights to assist users in reviewing historical data in a structured & informed format.</p>

                <div class="section-title">Independent & Data-Only</div>
                <p>Punt Data is completely independent and not affiliated with Trackside, Keno, or any wagering operator. All analysis is based solely on publicly available factual results.</p>

                <div class="section-title">What You’ll Find Inside</div>
                <ul style="padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 8px;">Trackside Averages, Droughts, 24-hour breakdowns, Combination Form Guide</li>
                    <li style="margin-bottom: 8px;">Top 10 most common Quinella, Exacta, Trifecta & First Fours</li>
                    <li style="margin-bottom: 8px;">Trackside Exotic Calculators</li>
                    <li style="margin-bottom: 8px;">Frequency and drought tracking</li>
                    <li style="margin-bottom: 8px;">Keno number frequency and drought analysis</li>
                </ul>

                <div class="section-title">Bonus Calculators</div>
                <p>Included as a bonus:</p>
                <ul style="padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 8px;">Bonus Bet Calculator</li>
                    <li style="margin-bottom: 8px;">Arbitrage Calculator</li>
                    <li style="margin-bottom: 8px;">Matched Betting Calculator</li>
                </ul>
                <p class="small-text">These tools use simple maths and hypothetical examples to help with planning and understanding bet structures.</p>

                <div class="section-title">Understanding Keno & Trackside</div>
                <ul style="padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 12px;">When Trackside results are analysed at scale, outcomes are not evenly distributed.</li>
                    <li style="margin-bottom: 12px;">While nothing is guaranteed, understanding this historical weighting gives punters better context around historical results, rather than treating every runner as equal.</li>
                    <li style="margin-bottom: 12px;">Trackside currently allows you to cash out bets with games remaining.**</li>
                    <li style="margin-bottom: 12px;">In Keno, regardless of if a number has appeared in 10 consecutive games or did not appear in 10 consecutive games, the odds of a number coming up is fixed at 25% or 1/4.</li>
                </ul>

                <div class="section-title">Important to Know</div>
                <ul style="padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 8px;">Punt Data does not provide tips or guarantees</li>
                    <li style="margin-bottom: 8px;">All insights are based on past results only</li>
                    <li style="margin-bottom: 8px;">Betting always involves chance</li>
                    <li style="margin-bottom: 8px;">Final decisions are always yours</li>
                </ul>

                <div class="section-title">Free Trial &Responsible Gambling</div>
                <p>Your free trial gives you full access for 7 days — you can cancel anytime during the trial if you decide Punt Data isn’t for you. Following the free trial, the subscription will continue unless cancelled.*</p>
                <p><span class="bold">Always gamble within your limits.</span> Support is available via Gambling Help Online or by calling 1800 858 858.</p>

                <center>
                    <a href="https://www.puntdata.com.au" class="button">Explore Your Dashboard</a>
                </center>
            </div>
            <div class="footer">
                <p>&copy; 2026 Punt Data. All rights reserved.</p>
                <p>
                    <a href="https://www.puntdata.com.au/privacy-policy">Privacy Policy</a> | 
                    <a href="https://www.puntdata.com.au/terms-of-service">Terms of Service</a>
                </p>
                <p class="small-text" style="margin-top: 15px;">
                    *After the 7-day free trial ends, your subscription will automatically renew at $29.99 per month unless cancelled before the renewal date. You can cancel anytime via your account dashboard prior to renewal.
                </p>
                <p class="small-text">
                    **Wagering operator features are determined by the relevant operator and may change at any time. Users should refer directly to the operator’s official terms and conditions.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};
