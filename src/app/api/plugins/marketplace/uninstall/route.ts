import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, scope } = body as {
      name: string;
      scope?: "user" | "project" | "local";
    };

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "plugin name is required" },
        { status: 400 }
      );
    }

    const args = ["plugin", "uninstall", name];
    if (scope) {
      args.push("--scope", scope);
    }

    const child = spawn("claude", args, {
      env: { ...process.env },
      shell: true,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: string) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        child.stdout?.on("data", (chunk: Buffer) => {
          send("output", chunk.toString());
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          send("output", chunk.toString());
        });

        child.on("close", (code) => {
          if (code === 0) {
            send("done", "Plugin uninstalled successfully");
          } else {
            send("error", `Process exited with code ${code}`);
          }
          controller.close();
        });

        child.on("error", (err) => {
          send("error", err.message);
          controller.close();
        });
      },
      cancel() {
        child.kill();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[plugins/marketplace/uninstall] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Uninstall failed" },
      { status: 500 }
    );
  }
}
