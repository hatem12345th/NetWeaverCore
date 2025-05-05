import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

export async function sendCommandsOverSSH(host, username, password, commands = []) {
  try {
    await ssh.connect({ host, username, password });

    let fullOutput = '';
    for (const command of commands) {
      const result = await ssh.execCommand(command);
      fullOutput += `> ${command}\n${result.stdout || result.stderr}\n\n`;
    }

    ssh.dispose();
    return { success: true, output: fullOutput };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
