import type { HealthCheckResult } from '@adonisjs/core/types/health'
import { BaseCheck, Result } from '@adonisjs/core/health'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class BuildInfoCheck extends BaseCheck {
  name = 'Build info check'
  async run(): Promise<HealthCheckResult> {
    const build = this.loadBuildInfo()

    if (!build.commit) {
      return Result.warning('Build info loaded without git metadata').mergeMetaData(build)
    }

    return Result.ok('Build info loaded').mergeMetaData(build)
  }

  private getGitInfo() {
    try {
      const run = (cmd: string) =>
        execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

      return {
        hash: run('git rev-parse --short HEAD'),
        message: run('git log -1 --pretty=%s'),
        author: run('git log -1 --pretty=%an'),
        date: run('git log -1 --pretty=%ci'),
      }
    } catch {
      return undefined
    }
  }

  private loadBuildInfo() {
    let version: string = '0.0.0'

    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
      version = pkg.version ?? '0.0.0'
    } catch {}

    return {
      version,
      commit: this.getGitInfo(),
    }
  }
}
