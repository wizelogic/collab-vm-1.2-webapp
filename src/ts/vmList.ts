import CollabVMClient from './protocol/CollabVMClient.js';
import Config from '../../config.json';
import * as dompurify from 'dompurify';
import { elements } from './dom.js';
import { openVM } from './vmController.js';
import { cards, vms } from './state.js';

export async function multicollab(url: string) {
    // Create the client
    const client = new CollabVMClient(url);

    await client.WaitForOpen();

    // Get the list of VMs and online count
    const list = await client.list();
    const online = client.getUsers().length;

    // Close the client
    client.close();

    // Add to the list
    vms.push(...list);

    // Add to the DOM
    for (const vm of list) {
        const div = document.createElement('div');
        div.classList.add('col-sm-5', 'col-md-3');

        const card = document.createElement('div');
        card.classList.add('card');
        if (Config.NSFWVMs.includes(vm.id)) card.classList.add('cvm-nsfw');

        // use dataset for data-cvm-node
        card.dataset.cvmNode = vm.id;
        card.addEventListener('click', () =>
            openVM(vm).catch(e => alert((e as Error).message))
        );

        vm.thumbnail.classList.add('card-img-top');

        const cardBody = document.createElement('div');
        cardBody.classList.add('card-body');

        const cardTitle = document.createElement('h5');
        cardTitle.innerHTML = Config.RawMessages.VMTitles
            ? vm.displayName
            : dompurify.sanitize(vm.displayName);

        const usersOnline = document.createElement('span');
        usersOnline.innerHTML = `(<i class="fa-solid fa-users"></i> ${online})`;

        cardBody.append(cardTitle, usersOnline);
        card.append(vm.thumbnail, cardBody);
        div.append(card);

        cards.push(div);
        sortVMList();
    }
}

export async function loadList() {
    // Fetch any extra VM URLs
    const jsonVMs = Config.ServerAddressesListURI
        ? await (await fetch(Config.ServerAddressesListURI)).json()
        : [];

    // Load all nodes in parallel
    const urls = [...Config.ServerAddresses, ...jsonVMs];
    await Promise.all(urls.map(url => multicollab(url)));

    // Automatically join the VM in the URL hash, if present
    const id = location.hash.slice(1);
    const vm = vms.find(v => v.id === id);
    if (vm) {
        await openVM(vm).catch(e => alert((e as Error).message));
    }
}

export function sortVMList() {
    const container = elements.vmlist.children[0] as HTMLElement;
  
    cards.sort((
      a: HTMLDivElement,
      b: HTMLDivElement
    ): number =>
      a
        .children[0]
        .getAttribute('data-cvm-node')!
        .localeCompare(
          b.children[0].getAttribute('data-cvm-node')!
        )
    );
  
    container.innerHTML = '';
    cards.forEach((card: HTMLDivElement) => {
      container.appendChild(card);
    });
  }  