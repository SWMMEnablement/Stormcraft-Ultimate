import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema } from "@shared/schema";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all projects
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Create project
  app.post("/api/projects", async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validated);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create project" });
      }
    }
  });

  // Update project
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const validated = updateProjectSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, validated);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update project" });
      }
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.post("/api/simulate", async (req, res) => {
    try {
      const { inpContent } = req.body;
      if (!inpContent || typeof inpContent !== 'string') {
        return res.status(400).json({ error: "Missing inpContent" });
      }

      const simId = randomUUID();
      const simDir = join("/tmp", "swmm_sim_" + simId);
      await mkdir(simDir, { recursive: true });

      const inpPath = join(simDir, "model.inp");
      const rptPath = join(simDir, "model.rpt");
      const outPath = join(simDir, "model.out");

      await writeFile(inpPath, inpContent);

      const swmmBin = join(process.cwd(), "server", "swmm5");

      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        execFile(swmmBin, [inpPath, rptPath, outPath], { timeout: 60000 }, (error, stdout, stderr) => {
          const code = error ? (typeof (error as any).code === 'number' ? (error as any).code : 1) : 0;
          resolve({ code, stdout: stdout || '', stderr: stderr || '' });
        });
      });

      let rptContent = '';
      try {
        rptContent = await readFile(rptPath, 'utf-8');
      } catch {
        rptContent = 'Report file not generated.\n' + result.stderr;
      }

      try { await unlink(inpPath); } catch {}
      try { await unlink(outPath); } catch {}
      try { await unlink(rptPath); } catch {}
      try { const { rmdir } = await import('fs/promises'); await rmdir(simDir); } catch {}

      res.json({
        success: result.code === 0 || rptContent.length > 100,
        rptContent,
        inpContent,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (error) {
      res.status(500).json({ error: "Simulation failed: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  return httpServer;
}
