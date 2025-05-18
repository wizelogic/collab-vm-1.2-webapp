import { elements }     from './dom.js';
import { getActiveVM }  from './state.js';

export async function sendQEMUCommand() {
  const vm     = getActiveVM();
  const input  = elements.qemuMonitorInput;
  const output = elements.qemuMonitorOutput;
  const cmd    = input.value;
  if (!cmd || !vm) return;

  output.innerHTML += `&gt; ${cmd}\n`;
  input.value = '';

  const response = await vm.qemuMonitor(cmd);
  output.innerHTML += `${response}\n`;
  output.scrollTop = output.scrollHeight;
}

elements.qemuMonitorSendBtn.addEventListener('click', sendQEMUCommand);
elements.qemuMonitorInput.addEventListener('keypress', ({ key }) =>
  key === 'Enter' && sendQEMUCommand()
);