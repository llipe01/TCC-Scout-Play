# ScoutPlay — guia para iniciar

Este guia mostra como preparar e abrir o ScoutPlay no Windows. O sistema precisa de um banco MySQL para guardar contas, perfis, publicações e vídeos.

## O que você precisa

- Windows 10 ou 11.
- Node.js 18 ou mais novo. Baixe a versão LTS em [nodejs.org](https://nodejs.org/) e instale. Isso também instala o npm.
- MySQL 8 ou mais novo, com o MySQL Server em execução. O MySQL Workbench é opcional, mas facilita a configuração do banco.

## 1. Abra a pasta do projeto

Extraia a pasta do projeto, se ela veio compactada. No Explorador de Arquivos, abra a pasta `scoutplay-fixed` — aquela que contém `package.json`, `src` e `database`.

Na barra de endereço do Explorador, digite `powershell` e pressione Enter. Isso abre o terminal já dentro da pasta correta.

## 2. Crie as tabelas no MySQL

Na primeira execução, importe o arquivo `database/scoutplay.sql` para o MySQL. Escolha uma das opções:

### Usando MySQL Workbench

1. Abra o MySQL Workbench e conecte ao seu servidor local.
2. Use **File > Open SQL Script** e selecione `database/scoutplay.sql` dentro da pasta do projeto.
3. Clique no botão do raio (**Execute**) para rodar o script.

### Usando o terminal

Se o cliente de linha de comando do MySQL estiver instalado e disponível no PATH, rode no PowerShell, a partir da pasta do projeto:

```powershell
mysql -u root -p < database/scoutplay.sql
```

Digite a senha do MySQL quando solicitado. O script cria o banco `scoutplay` e suas tabelas.

> **Atenção:** o script apaga e recria as tabelas. Rodá-lo novamente apaga os dados que já estavam nelas. Use-o apenas na primeira instalação ou se quiser recomeçar do zero.

## 3. Configure a conexão com o banco

Na pasta do projeto existe um arquivo `.env.example`. Faça uma cópia com o nome `.env` e abra `.env` em um editor de texto. No PowerShell, você pode copiar com:

```powershell
Copy-Item .env.example .env
```

No `.env`, informe os dados do seu MySQL:

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=scoutplay
JWT_SECRET=escreva_aqui_um_texto_longo_e_aleatorio
PORT=3000
```

Troque `sua_senha_do_mysql` pela senha que você usa no MySQL. Troque também o valor de `JWT_SECRET` por um texto longo e difícil de adivinhar. Não compartilhe o arquivo `.env`.

## 4. Instale e inicie o sistema

No PowerShell aberto na pasta do projeto, rode:

```powershell
npm install
npm run build
npm start
```

A instalação (`npm install`) só precisa ser feita na primeira vez ou quando as dependências do projeto mudarem. O comando de compilação (`npm run build`) prepara os arquivos do site. O comando `npm start` inicia o servidor e deve mostrar `ScoutPlay rodando em http://localhost:3000`.

Deixe essa janela do PowerShell aberta enquanto estiver usando o sistema. Abra [http://localhost:3000](http://localhost:3000) no navegador. Para encerrar, volte ao PowerShell e pressione `Ctrl+C`.

Na primeira visita, crie uma conta escolhendo atleta ou olheiro.

## Se algo não funcionar

- **`npm` não é reconhecido:** instale o Node.js e feche e abra o PowerShell novamente.
- **Erro ao conectar ao MySQL:** confirme que o serviço MySQL está iniciado e que usuário, senha e porta no `.env` estão corretos.
- **Tabelas não encontradas:** importe `database/scoutplay.sql` conforme o passo 2.
- **A porta 3000 já está em uso:** feche a outra aplicação que estiver usando essa porta ou altere `PORT` no `.env`.
- **Mudou arquivos da interface e não vê a mudança:** rode `npm run build` novamente e atualize o navegador.

## Observações

- Vídeos de até 100 MB e fotos de perfil são armazenados no MySQL; planeje espaço suficiente no banco.
- Stories expiram depois de 24 horas.
- O arquivo `.env` contém credenciais e não deve ser enviado ou compartilhado.
