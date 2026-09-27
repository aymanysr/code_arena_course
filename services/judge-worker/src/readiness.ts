import { execFile } from "node:child_process";

export interface ReadinessSnapshot {
  ready: boolean;
  docker: boolean;
  images: Record<string, boolean>;
}

export interface JudgeReadinessProbe {
  check(): Promise<ReadinessSnapshot>;
}

export type DockerCommand = (dockerBin: string, args: string[], timeoutMs: number) => Promise<void>;

function executeDocker(dockerBin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(dockerBin, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export interface DockerImageReadinessOptions {
  dockerBin?: string;
  images: Record<string, string>;
  timeoutMs?: number;
  run?: DockerCommand;
}

/** Checks both the Docker daemon and every image that ContainerJudge may use. */
export class DockerImageReadiness implements JudgeReadinessProbe {
  private readonly dockerBin: string;
  private readonly images: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly run: DockerCommand;

  constructor(options: DockerImageReadinessOptions) {
    if (Object.keys(options.images).length === 0) throw new Error("at least one judge image is required");
    this.dockerBin = options.dockerBin ?? "docker";
    this.images = { ...options.images };
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.run = options.run ?? executeDocker;
  }

  async check(): Promise<ReadinessSnapshot> {
    let docker = false;
    try {
      await this.run(this.dockerBin, ["info", "--format", "{{.ServerVersion}}"], this.timeoutMs);
      docker = true;
    } catch {
      return {
        ready: false,
        docker: false,
        images: Object.fromEntries(Object.keys(this.images).map((name) => [name, false])),
      };
    }

    const imageEntries = await Promise.all(Object.entries(this.images).map(async ([name, image]) => {
      try {
        await this.run(this.dockerBin, ["image", "inspect", image], this.timeoutMs);
        return [name, true] as const;
      } catch {
        return [name, false] as const;
      }
    }));
    const imageStatus = Object.fromEntries(imageEntries);
    return {
      ready: docker && Object.values(imageStatus).every(Boolean),
      docker,
      images: imageStatus,
    };
  }
}
