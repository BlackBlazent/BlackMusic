#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Since chokidar might not be available, let's use Node.js built-in fs.watch
interface FileChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  filePath: string;
  relativePath: string;
  timestamp: Date;
  size?: number;
  extension: string;
  description?: string;
  previousPath?: string;
}

interface DevSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  projectPath: string;
  changes: FileChange[];
  fileTree: string;
  totalFiles: number;
  totalChanges: number;
}

class DevelopmentFileWatcher {
  private watchers: fs.FSWatcher[] = [];
  private currentSession: DevSession | null = null;
  private projectPath: string;
  private logDir: string;
  private fileHashes: Map<string, string> = new Map();
  private ignoredPatterns: string[];
  private sessionStartTime: Date;
  private watchedDirs: Set<string> = new Set();

  constructor(projectPath: string, logDir: string = './dev-logs') {
    this.projectPath = path.resolve(projectPath);
    this.logDir = path.resolve(logDir);
    this.sessionStartTime = new Date();
    
    // Common patterns to ignore
    this.ignoredPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.vscode',
      '.idea',
      'tmp',
      'temp',
      '.DS_Store',
      'Thumbs.db'
    ];

    this.initializeSession();
    this.ensureLogDirectory();
  }

  private initializeSession(): void {
    const sessionId = this.generateSessionId();
    this.currentSession = {
      sessionId,
      startTime: this.sessionStartTime,
      projectPath: this.projectPath,
      changes: [],
      fileTree: '',
      totalFiles: 0,
      totalChanges: 0
    };

    console.log(`🚀 Development session started: ${sessionId}`);
    console.log(`📁 Watching project: ${this.projectPath}`);
  }

  private generateSessionId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `session.dev.${year}.${month}.${day}.${hour}-${minute}-${second}`;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private generateFileTree(dirPath: string, prefix: string = '', isLast: boolean = true): string {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(item => !this.shouldIgnore(item.name))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      let tree = '';
      
      items.forEach((item, index) => {
        const isLastItem = index === items.length - 1;
        const connector = isLastItem ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLastItem ? '    ' : '│   ');
        
        const itemPath = path.join(dirPath, item.name);
        const icon = this.getFileIcon(item.name, item.isDirectory());
        
        tree += `${prefix}${connector}${icon} ${item.name}\n`;
        
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          try {
            tree += this.generateFileTree(itemPath, nextPrefix, isLastItem);
          } catch (error) {
            // Skip directories we can't read
          }
        }
      });

      return tree;
    } catch (error) {
      return `${prefix}└── ❌ (Permission denied)\n`;
    }
  }

  private getFileIcon(fileName: string, isDirectory: boolean): string {
    if (isDirectory) return '📁';
    
    const ext = path.extname(fileName).toLowerCase();
    const iconMap: { [key: string]: string } = {
      '.js': '🟨', '.ts': '🔷', '.jsx': '⚛️', '.tsx': '⚛️',
      '.html': '🌐', '.css': '🎨', '.scss': '🎨', '.sass': '🎨',
      '.json': '📋', '.xml': '📄', '.yaml': '📄', '.yml': '📄',
      '.md': '📝', '.txt': '📄', '.log': '📜',
      '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
      '.pdf': '📕', '.doc': '📘', '.docx': '📘',
      '.zip': '📦', '.rar': '📦', '.tar': '📦', '.gz': '📦',
      '.sql': '🗄️', '.db': '🗄️', '.sqlite': '🗄️',
      '.py': '🐍', '.java': '☕', '.cpp': '⚙️', '.c': '⚙️',
      '.php': '🐘', '.rb': '💎', '.go': '🐹', '.rs': '🦀'
    };

    return iconMap[ext] || '📄';
  }

  private shouldIgnore(fileName: string): boolean {
    return this.ignoredPatterns.some(pattern => 
      fileName.includes(pattern) || fileName.startsWith('.')
    );
  }

  private getFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  private getFileDescription(filePath: string, changeType: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const descriptions: { [key: string]: string } = {
      '.js': 'JavaScript file',
      '.ts': 'TypeScript file',
      '.jsx': 'React component',
      '.tsx': 'React TypeScript component',
      '.html': 'HTML document',
      '.css': 'Stylesheet',
      '.scss': 'Sass stylesheet',
      '.json': 'JSON configuration',
      '.md': 'Markdown documentation',
      '.png': 'Image file',
      '.jpg': 'Image file',
      '.svg': 'Vector image',
      '.sql': 'Database script',
      '.db': 'Database file'
    };

    const baseDesc = descriptions[ext] || 'File';
    
    switch (changeType) {
      case 'added': return `New ${baseDesc.toLowerCase()} created`;
      case 'modified': return `${baseDesc} updated`;
      case 'deleted': return `${baseDesc} removed`;
      default: return baseDesc;
    }
  }

  private scanDirectory(dirPath: string): void {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      items.forEach(item => {
        const fullPath = path.join(dirPath, item.name);
        
        if (this.shouldIgnore(item.name)) return;
        
        if (item.isDirectory()) {
          this.scanDirectory(fullPath);
          this.watchDirectory(fullPath);
        } else {
          const hash = this.getFileHash(fullPath);
          this.fileHashes.set(fullPath, hash);
        }
      });
    } catch (error) {
      // Ignore permission errors
    }
  }

  private watchDirectory(dirPath: string): void {
    if (this.watchedDirs.has(dirPath)) return;
    
    try {
      const watcher = fs.watch(dirPath, { persistent: true }, (eventType, filename) => {
        if (!filename || this.shouldIgnore(filename)) return;
        
        const fullPath = path.join(dirPath, filename);
        
        // Debounce rapid file changes
        setTimeout(() => {
          this.handleFileEvent(eventType, fullPath);
        }, 100);
      });

      this.watchers.push(watcher);
      this.watchedDirs.add(dirPath);
    } catch (error) {
      console.error(`Cannot watch directory ${dirPath}:`, error.message);
    }
  }

  private handleFileEvent(eventType: string, filePath: string): void {
    try {
      const exists = fs.existsSync(filePath);
      const previousHash = this.fileHashes.get(filePath);
      
      if (exists) {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          // New directory created
          if (!this.watchedDirs.has(filePath)) {
            this.watchDirectory(filePath);
            this.scanDirectory(filePath);
          }
          return;
        }
        
        const currentHash = this.getFileHash(filePath);
        
        if (!previousHash) {
          // New file
          this.recordChange('added', filePath, stats.size);
          this.fileHashes.set(filePath, currentHash);
        } else if (currentHash !== previousHash) {
          // Modified file
          this.recordChange('modified', filePath, stats.size);
          this.fileHashes.set(filePath, currentHash);
        }
      } else if (previousHash) {
        // Deleted file
        this.recordChange('deleted', filePath);
        this.fileHashes.delete(filePath);
      }
    } catch (error) {
      // Handle file access errors silently
    }
  }

  private recordChange(type: 'added' | 'modified' | 'deleted', filePath: string, size?: number): void {
    const relativePath = path.relative(this.projectPath, filePath);
    const extension = path.extname(filePath);

    const change: FileChange = {
      type,
      filePath,
      relativePath,
      timestamp: new Date(),
      size,
      extension,
      description: this.getFileDescription(filePath, type)
    };

    this.currentSession!.changes.push(change);
    this.currentSession!.totalChanges++;

    const icon = type === 'added' ? '✅' : type === 'modified' ? '🔄' : '❌';
    console.log(`${icon} ${type.toUpperCase()}: ${relativePath}`);

    // Update file tree occasionally
    if (this.currentSession!.changes.length % 10 === 0) {
      this.updateFileTree();
    }
  }

  public startWatching(): void {
    console.log('🔍 Scanning existing files...');
    this.scanDirectory(this.projectPath);
    console.log(`📊 Found ${this.fileHashes.size} files`);

    console.log('👀 Starting file watchers...');
    this.watchDirectory(this.projectPath);

    this.updateFileTree();
    
    console.log('✅ File watcher is now active!');
    console.log('💡 Press Ctrl+C to stop and generate session log');
  }

  private updateFileTree(): void {
    try {
      this.currentSession!.fileTree = this.generateFileTree(this.projectPath);
      this.currentSession!.totalFiles = this.fileHashes.size;
    } catch (error) {
      console.error('Error updating file tree:', error);
    }
  }

  public stopWatching(): void {
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch (error) {
        // Ignore close errors
      }
    });

    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.generateSessionLog();
    }

    console.log('🛑 File watcher stopped');
  }

  private generateSessionLog(): void {
    if (!this.currentSession) return;

    const session = this.currentSession;
    const logFileName = `${session.sessionId}.log`;
    const logPath = path.join(this.logDir, logFileName);

    const added = session.changes.filter(c => c.type === 'added');
    const modified = session.changes.filter(c => c.type === 'modified');
    const deleted = session.changes.filter(c => c.type === 'deleted');

    const duration = session.endTime 
      ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60)
      : 0;

    const logContent = `# 🔍 Development Session Log
## Session: ${session.sessionId}

### 📊 Session Summary
- **Start Time**: ${session.startTime.toLocaleString()}
- **End Time**: ${session.endTime?.toLocaleString() || 'In Progress'}
- **Duration**: ${duration} minutes
- **Project Path**: \`${session.projectPath}\`
- **Total Files**: ${session.totalFiles}
- **Total Changes**: ${session.totalChanges}

### 📁 Project File Structure
\`\`\`
${session.fileTree || 'Unable to generate file tree'}
\`\`\`

${added.length > 0 ? `### ✅ Added Files (${added.length})
| File Path | Description | Size | Time |
|-----------|-------------|------|------|
${added.map(change => 
  `| \`${change.relativePath}\` | ${change.description} | ${change.size ? this.formatFileSize(change.size) : 'N/A'} | ${change.timestamp.toLocaleTimeString()} |`
).join('\n')}
` : ''}

${modified.length > 0 ? `### 🔄 Modified Files (${modified.length})
| File Path | Description | Size | Time |
|-----------|-------------|------|------|
${modified.map(change => 
  `| \`${change.relativePath}\` | ${change.description} | ${change.size ? this.formatFileSize(change.size) : 'N/A'} | ${change.timestamp.toLocaleTimeString()} |`
).join('\n')}
` : ''}

${deleted.length > 0 ? `### ❌ Deleted Files (${deleted.length})
| File Path | Description | Time |
|-----------|-------------|------|
${deleted.map(change => 
  `| \`${change.relativePath}\` | ${change.description} | ${change.timestamp.toLocaleTimeString()} |`
).join('\n')}
` : ''}

### 📈 Activity Timeline
${session.changes.length > 0 ? session.changes.map(change => {
  const icon = change.type === 'added' ? '✅' : change.type === 'modified' ? '🔄' : '❌';
  return `- **${change.timestamp.toLocaleTimeString()}** ${icon} ${change.type.toUpperCase()}: \`${change.relativePath}\``;
}).join('\n') : '- No changes recorded during this session'}

---
*Generated by Development File Watcher on ${new Date().toLocaleString()}*
`;

    fs.writeFileSync(logPath, logContent, 'utf8');
    console.log(`📝 Session log saved: ${logPath}`);
    console.log(`📂 Log location: ${logPath}`);
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// Main execution
function main() {
  const projectPath = process.argv[2] || process.cwd();
  const logDir = process.argv[3] || path.join(process.cwd(), 'dev-logs');

  console.log('🚀 Starting Development File Watcher...');
  console.log(`📁 Project: ${projectPath}`);
  console.log(`📝 Logs: ${logDir}`);

  const watcher = new DevelopmentFileWatcher(projectPath, logDir);

  // Start watching
  watcher.startWatching();

  // Graceful shutdown
  const cleanup = () => {
    console.log('\n🔄 Generating session log...');
    watcher.stopWatching();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGQUIT', cleanup);
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export default DevelopmentFileWatcher;