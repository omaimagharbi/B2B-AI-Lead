-- 83 : Real Estate OS - lot 9 : paiement en ligne (lien de paiement MyFatoorah, QAR) rattache a un deal.
-- Idempotent. AUCUNE donnee de carte n'est stockee : le client paie sur la page hebergee par MyFatoorah.
-- La cle API n'est JAMAIS stockee ici (variable d'environnement MYFATOORAH_API_KEY).
-- Table ecrite uniquement par le serveur (api/payments.ts) ; lecture via ?r=all (filtree par agent pour les agents).

create table if not exists re_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  deal_id uuid references re_deals(id) on delete set null,
  contact_name text not null,
  contact_phone text,
  agent text,                                  -- agent du deal (ou createur) : sert au filtrage "un agent ne voit que ses donnees"
  kind text not null default 'deposit' check (kind in ('deposit','commission','rent','service','other')),
  amount numeric(14,2) not null check (amount > 0 and amount <= 10000000),
  currency text not null default 'QAR' check (currency = 'QAR'),
  description text,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','expired')),
  provider text not null default 'myfatoorah',
  ref text not null unique,                    -- jeton aleatoire = CustomerReference cote MyFatoorah (verifie au retour)
  invoice_id text,
  payment_id text,
  pay_url text,
  created_by text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table re_payments enable row level security;
create index if not exists idx_re_payments_client on re_payments(client_id, created_at desc);
create index if not exists idx_re_payments_deal on re_payments(client_id, deal_id);
create index if not exists idx_re_payments_invoice on re_payments(invoice_id);
