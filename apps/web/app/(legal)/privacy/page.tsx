import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Quais dados o cardápio e o painel usam, para quê e como pedir acesso ou exclusão.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="21 de outubro de 2026">
      <p>
        Este cardápio digital é operado pela loja que você vê nele. Ela é a responsável (controladora,
        nos termos da Lei Geral de Proteção de Dados, LGPD) pelos dados de quem faz pedidos e de quem
        trabalha no painel. Aqui explicamos o que é coletado, para quê e quais são os seus direitos.
      </p>

      <h2>Dados de quem faz pedidos</h2>
      <ul>
        <li>
          <strong>Nome e celular</strong>, para identificar o seu pedido no balcão e avisar quando ele
          estiver pronto.
        </li>
        <li>
          <strong>O pedido</strong>: itens, adicionais, observações, valores, forma de pagamento e
          horários.
        </li>
        <li>
          <strong>E-mail</strong>, apenas se você pagar com Pix ou cartão pelo site: o Mercado Pago o
          exige para emitir o pagamento.
        </li>
        <li>
          <strong>No seu aparelho</strong>: a sacola, o seu nome e celular (para não digitar de novo)
          e um código que liga este aparelho ao seu histórico de pedidos. Você pode apagar esses dados
          limpando os dados do site no navegador.
        </li>
      </ul>

      <h2>Pagamentos</h2>
      <p>
        Pagamentos com Pix e cartão são processados pelo <strong>Mercado Pago</strong>. Os dados do
        cartão são digitados em um formulário do próprio Mercado Pago e nunca passam pelos nossos
        servidores; recebemos apenas a situação do pagamento. O uso desses dados segue a{" "}
        <a href="https://www.mercadopago.com.br/privacidade" target="_blank" rel="noreferrer">
          política de privacidade do Mercado Pago
        </a>
        .
      </p>

      <h2>Dados de quem usa o painel</h2>
      <ul>
        <li>
          <strong>Nome, e-mail e senha</strong> (guardada de forma irreversível, com hash) da equipe
          da loja.
        </li>
        <li>
          <strong>Login com Google</strong>, se você usar: recebemos o seu nome, e-mail e o
          identificador da conta Google, só para entrar na conta que a loja já criou para você. Não
          publicamos nada nem acessamos outros dados da sua conta Google.
        </li>
        <li>
          <strong>Notificações</strong>: se você permitir, um identificador do aparelho para enviar
          avisos (via Firebase Cloud Messaging, do Google).
        </li>
      </ul>

      <h2>Cookies e dados técnicos</h2>
      <p>
        Usamos um cookie essencial para manter a equipe conectada ao painel. Não usamos cookies de
        publicidade nem rastreamento de terceiros. Contamos acessos ao cardápio de forma agregada
        (quantidade por hora e tipo de aparelho, sem identificar ninguém) e registramos o endereço IP
        temporariamente para limitar abusos.
      </p>

      <h2>Com quem compartilhamos</h2>
      <p>
        Somente com quem ajuda a prestar o serviço: o Mercado Pago (pagamentos), o Google (login e
        notificações, quando usados), o provedor de e-mail (mensagens como redefinição de senha) e a
        hospedagem do sistema. Não vendemos dados.
      </p>

      <h2>Por quanto tempo</h2>
      <p>
        Os pedidos ficam guardados enquanto forem necessários para a operação da loja e para
        obrigações legais e fiscais. Contas da equipe ficam ativas enquanto a pessoa fizer parte da
        loja.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Pela LGPD, você pode pedir a confirmação de que tratamos seus dados, acesso a eles, correção,
        exclusão (quando não houver obrigação de guardar) e informações sobre o compartilhamento. Para
        isso, fale com a loja pelos contatos que aparecem no cardápio (telefone, endereço ou redes
        sociais).
      </p>

      <h2>Mudanças</h2>
      <p>
        Se esta política mudar, a data no topo desta página será atualizada.
      </p>
    </LegalPage>
  );
}
