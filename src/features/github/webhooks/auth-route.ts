import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { env } from "@/config/env.js";
import { db } from "@/core/database.js";
import { logger } from "@/core/logger.js";
import { githubOauthStates, githubUserLinks } from "@/features/github/schema.js";

export const githubAuthRoute = new Hono();

githubAuthRoute.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.text("Missing code or state.", 400);
  }

  // Verify the state parameter against our DB to prevent CSRF
  try {
    const [oauthState] = await db
      .select()
      .from(githubOauthStates)
      .where(eq(githubOauthStates.state, state))
      .limit(1);

    if (!oauthState) {
      return c.text(
        "Invalid or expired state parameter. Please try linking again from Discord.",
        400,
      );
    }

    // Optional: Delete state so it can't be reused
    await db.delete(githubOauthStates).where(eq(githubOauthStates.state, state));

    // Exchange the code for an access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      logger.error("Failed to fetch access token from GitHub");
      return c.text("Failed to exchange token with GitHub.", 500);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      logger.error({ error: tokenData.error }, "GitHub returned an error for token exchange");
      return c.text(`GitHub Error: ${tokenData.error_description || tokenData.error}`, 400);
    }

    const accessToken = tokenData.access_token;

    // Fetch the authenticated user's profile from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "NxtGen-Discord-Bot",
      },
    });

    if (!userResponse.ok) {
      return c.text("Failed to fetch GitHub user profile.", 500);
    }

    const userData = (await userResponse.json()) as { login: string };

    // Upsert the Discord, GitHub link into the database
    await db
      .insert(githubUserLinks)
      .values({
        discordId: oauthState.discordId,
        githubUsername: userData.login,
        githubAccessToken: accessToken,
      })
      .onConflictDoUpdate({
        target: githubUserLinks.discordId,
        set: {
          githubUsername: userData.login,
          githubAccessToken: accessToken,
          updatedAt: new Date(),
        },
      });

    logger.info(
      { discordId: oauthState.discordId, githubUsername: userData.login },
      "Successfully linked GitHub account via OAuth",
    );

    // Return success
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Account Linked</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f3f4f6; margin: 0; }
          .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; }
          h1 { color: #10b981; }
          p { color: #4b5563; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Successfully Linked!</h1>
          <p>Your GitHub account (<b>${userData.login}</b>) has been successfully linked to your Discord account.</p>
          <p>You can close this tab and return to Discord.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error({ err: error }, "Failed to process GitHub OAuth callback");
    return c.text("Internal Server Error.", 500);
  }
});
