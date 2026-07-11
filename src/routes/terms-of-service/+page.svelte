<script lang="ts">
  import type { PageProps } from './$types';
  import * as m from '$lib/paraglide/messages';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.legal_tos_title()} — {m.app_name()}</title>
</svelte:head>

<div class="mx-auto max-w-prose px-4 py-12 md:py-16">
  <h1 class="text-foreground mb-2 text-3xl font-bold tracking-tight">
    {m.legal_tos_title()}
  </h1>
  <p class="text-muted-foreground mb-10 text-sm">{m.legal_tos_last_updated()}</p>

  <div class="prose prose-gray dark:prose-invert max-w-none space-y-8">
    <!-- Acceptance of Terms -->
    <section>
      <p>{m.legal_tos_acceptance_desc()}</p>
    </section>

    <!-- Service Description -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_description()}
      </h2>
      <p>{m.legal_tos_description_desc()}</p>
    </section>

    <!-- User Accounts -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_accounts()}
      </h2>
      <p>{m.legal_tos_accounts_desc()}</p>
    </section>

    <!-- Acceptable Use -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_acceptable_use()}
      </h2>
      <p>{m.legal_tos_acceptable_use_desc()}</p>
    </section>

    <!-- Service Availability -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_availability()}
      </h2>
      <p>{m.legal_tos_availability_desc()}</p>
    </section>

    <!-- Limitation of Liability -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_liability()}
      </h2>
      <p>{m.legal_tos_liability_desc()}</p>
    </section>

    <!-- Intellectual Property -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_intellectual_property()}
      </h2>
      <p>{m.legal_tos_intellectual_property_desc()}</p>
    </section>

    <!-- Termination -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_termination()}
      </h2>
      <p>{m.legal_tos_termination_desc()}</p>
    </section>

    <!-- Changes to Terms -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_changes()}
      </h2>
      <p>{m.legal_tos_changes_desc()}</p>
    </section>

    <!-- Governing Law -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_governing_law()}
      </h2>
      <p>{m.legal_tos_governing_law_desc()}</p>
    </section>

    <!-- Contact -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_tos_contact()}
      </h2>
      <p>{m.legal_tos_contact_desc()}</p>
      <p class="mt-2 font-medium">{data.contactEmail}</p>
    </section>
  </div>
</div>
