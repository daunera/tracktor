<script lang="ts">
  import type { PageProps } from './$types';
  import * as m from '$lib/paraglide/messages';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.legal_privacy_title()} — {m.app_name()}</title>
</svelte:head>

<div class="mx-auto max-w-prose px-4 py-12 md:py-16">
  <h1 class="text-foreground mb-2 text-3xl font-bold tracking-tight">
    {m.legal_privacy_title()}
  </h1>
  <p class="text-muted-foreground mb-10 text-sm">{m.legal_privacy_last_updated()}</p>

  <div class="prose prose-gray dark:prose-invert max-w-none space-y-8">
    <!-- Introduction -->
    <section>
      <p>{m.legal_privacy_intro()}</p>
    </section>

    <!-- Information We Collect -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_data_collected()}
      </h2>
      <p>{m.legal_privacy_data_collected_desc()}</p>
    </section>

    <!-- How We Use Your Information -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_purpose()}
      </h2>
      <p>{m.legal_privacy_purpose_desc()}</p>
    </section>

    <!-- Data Storage and Security -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_storage()}
      </h2>
      <p>{m.legal_privacy_storage_desc()}</p>
    </section>

    <!-- Data Sharing -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_sharing()}
      </h2>
      <p>{m.legal_privacy_sharing_desc()}</p>
    </section>

    <!-- Data Retention -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_retention()}
      </h2>
      <p>{m.legal_privacy_retention_desc()}</p>
    </section>

    <!-- Your Rights -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_rights()}
      </h2>
      <p>{m.legal_privacy_rights_desc()}</p>
    </section>

    <!-- Cookies -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_cookies()}
      </h2>
      <p>{m.legal_privacy_cookies_desc()}</p>
    </section>

    <!-- Contact -->
    <section>
      <h2 class="text-foreground mb-3 text-xl font-semibold">
        {m.legal_privacy_contact()}
      </h2>
      <p>{m.legal_privacy_contact_desc()}</p>
      <p class="mt-2 font-medium">{data.contactEmail}</p>
    </section>
  </div>
</div>
