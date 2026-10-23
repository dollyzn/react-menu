import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Termos de Uso",
  description: "Como funcionam os pedidos, pagamentos e cancelamentos pelo cardápio digital.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="21 de outubro de 2026">
      <p>
        Estes termos valem para o cardápio digital e o painel da loja que você vê nele. Ao fazer um
        pedido ou entrar no painel, você concorda com eles e com a{" "}
        <Link href="/privacy">Política de Privacidade</Link>.
      </p>

      <h2>Pedidos</h2>
      <ul>
        <li>Os pedidos são para retirada no balcão da loja; não fazemos entregas por aqui.</li>
        <li>
          Preços, disponibilidade e horário de funcionamento são os mostrados no cardápio no momento
          do pedido. O valor final é calculado pela loja ao receber o pedido.
        </li>
        <li>
          O tempo de preparo informado é uma estimativa. Você acompanha o andamento na página do
          pedido.
        </li>
        <li>Informe um nome e um celular verdadeiros: são eles que identificam o seu pedido.</li>
      </ul>

      <h2>Pagamento</h2>
      <ul>
        <li>
          Conforme a loja oferecer, você paga pelo site (Pix ou cartão, pelo Mercado Pago) ou na
          retirada.
        </li>
        <li>
          Pedidos com pagamento online que não forem pagos dentro do prazo mostrado são cancelados
          automaticamente.
        </li>
      </ul>

      <h2>Cancelamentos e reembolsos</h2>
      <p>
        Se a loja não puder atender um pedido já pago, ela o cancela e o valor é estornado pelo mesmo
        meio de pagamento, nos prazos do Mercado Pago e do seu banco ou cartão. Para cancelar ou tirar
        dúvidas sobre um pedido, fale com a loja pelos contatos do cardápio.
      </p>

      <h2>Painel da equipe</h2>
      <ul>
        <li>
          O acesso ao painel é pessoal e dado pela gerência da loja. Não compartilhe sua senha; quem
          sai da equipe perde o acesso.
        </li>
        <li>Use o painel apenas para a operação da loja.</li>
      </ul>

      <h2>Uso adequado</h2>
      <p>
        Não é permitido fazer pedidos falsos, tentar burlar preços ou pagamentos, ou atrapalhar o
        funcionamento do sistema. A loja pode recusar pedidos e bloquear acessos nesses casos.
      </p>

      <h2>Disponibilidade</h2>
      <p>
        Trabalhamos para manter o cardápio no ar, mas ele pode ficar indisponível por manutenção ou
        falhas. Nesses casos, você ainda pode pedir direto no balcão.
      </p>

      <h2>Mudanças</h2>
      <p>Se estes termos mudarem, a data no topo desta página será atualizada.</p>
    </LegalPage>
  );
}
