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
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
            }
            .header {
                background: linear-gradient(135deg, #1A365D 0%, #2B6CB0 100%);
                padding: 50px 30px;
                text-align: center;
                color: #ffffff;
            }
            .header h1 {
                margin: 0;
                font-size: 32px;
                font-weight: 800;
                letter-spacing: -1px;
            }
            .header p {
                margin-top: 10px;
                font-size: 18px;
                opacity: 0.9;
                font-weight: 500;
            }
            .content {
                padding: 40px;
            }
            .greeting {
                font-size: 22px;
                font-weight: 700;
                color: #1A365D;
                margin-bottom: 24px;
            }
            .intro {
                font-size: 16px;
                color: #4A5568;
                margin-bottom: 30px;
            }
            .section-title {
                font-size: 20px;
                font-weight: 800;
                color: #1A365D;
                margin: 40px 0 20px 0;
                text-transform: uppercase;
                letter-spacing: 1px;
                border-bottom: 2px solid #E2E8F0;
                padding-bottom: 8px;
            }
            .feature-item {
                margin-bottom: 28px;
            }
            .feature-title {
                font-size: 17px;
                font-weight: 700;
                color: #2B6CB0;
                margin-bottom: 6px;
            }
            .feature-description {
                font-size: 15px;
                color: #4A5568;
                line-height: 1.5;
            }
            .highlight-box {
                background-color: #F0F7FF;
                border-left: 4px solid #3182CE;
                padding: 24px;
                margin: 40px 0;
                border-radius: 0 8px 8px 0;
            }
            .highlight-text {
                font-size: 16px;
                color: #2C5282;
                margin: 0;
                font-weight: 500;
            }
            .button-container {
                text-align: center;
                margin: 40px 0;
            }
            .button {
                display: inline-block;
                padding: 16px 45px;
                background-color: #3182CE;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 700;
                font-size: 16px;
                box-shadow: 0 4px 14px rgba(49, 130, 206, 0.3);
            }
            .footer {
                background-color: #F8FAFC;
                padding: 40px 30px;
                text-align: center;
                font-size: 13px;
                color: #718096;
                border-top: 1px solid #E2E8F0;
            }
            .footer a {
                color: #3182CE;
                text-decoration: none;
                font-weight: 500;
            }
            .disclaimer {
                font-size: 12px;
                color: #A0AEC0;
                line-height: 1.6;
                text-align: left;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px dashed #E2E8F0;
            }
            .disclaimer-title {
                font-weight: 700;
                color: #718096;
                display: block;
                margin-bottom: 4px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to Punt Data</h1>
                <p>See the numbers behind the game</p>
            </div>
            <div class="content">
                <div class="greeting">Hello ${userName},</div>
                
                <p class="intro">Punt Data is an independent analytics platform designed to help punters better understand historical Trackside and Keno results using real published race and draw data. Instead of guessing, Punt Data allows you to explore long term patterns, hit frequencies, droughts and historical behaviour so you can see which entries and combinations appear more often and which may be on extended dry runs.</p>

                <div class="section-title">Features</div>

                <div class="feature-item">
                    <div class="feature-title">Trackside Exotic Analytics</div>
                    <div class="feature-description">Review the most frequent Quinella, Exacta, Trifecta and First Four combinations using large historical datasets. See average hit rates, drought statistics and dividend history.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-title">Trackside Cash Out Strategy Insights</div>
                    <div class="feature-description">Analyse historical hit frequency and behaviour of combinations to explore strategies that may benefit from Trackside’s cash out functionality.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-title">Keno Drought & Number Analysis</div>
                    <div class="feature-description">Track hot and cold numbers, extended droughts and historical number frequency across thousands of draws.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-title">Betting Calculators</div>
                    <div class="feature-description">Calculate flexi bets, exotic combinations and staking scenarios quickly and easily.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-title">Data Driven Insights</div>
                    <div class="feature-description">Understand average hit frequency, longest droughts and long term behaviour of entries and combinations.</div>
                </div>

                <div class="feature-item">
                    <div class="feature-title">Simple, Fast and Easy to Use</div>
                    <div class="feature-description">Built for punters who want quick access to clear data without complicated tools.</div>
                </div>

                <div class="highlight-box">
                    <p class="highlight-text">Punt Data focuses purely on analysing published historical results so users can better understand how often numbers and combinations appear over time. See what hits more often than others and what doesn’t.</p>
                </div>

                <div class="button-container">
                    <a href="https://www.puntdata.com.au" class="button">Go to My Dashboard</a>
                </div>

                <div class="disclaimer">
                    <span class="disclaimer-title">Historical results only.</span> Past performance does not guarantee future outcomes. Punt Data provides data analysis only and does not provide betting advice. Always gamble within your limits. Support is available via Gambling Help Online or by calling 1800 858 858.
                </div>
            </div>
            <div class="footer">
                <p>&copy; 2026 Punt Data. All rights reserved.</p>
                <p>
                    <a href="https://www.puntdata.com.au/privacy-policy">Privacy Policy</a> | 
                    <a href="https://www.puntdata.com.au/terms-of-service">Terms of Service</a>
                </p>
                <p style="margin-top: 20px; font-size: 11px; opacity: 0.8;">
                    You are receiving this email because you recently created an account at Punt Data.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

