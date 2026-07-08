<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import SearchX from '@lucide/svelte/icons/search-x';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as m from '$lib/paraglide/messages';

  let is404 = $derived(page.status === 404);

  function msg(fn: () => string, fallback: string): string {
    const result = fn();
    return result ?? fallback;
  }

  function goBack() {
    history.back();
  }
</script>

<div class="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
  <div class="bg-muted/50 border-border rounded-2xl border px-6 py-2">
    <span class="mono text-7xl font-bold tracking-tight">
      {is404 ? '404' : page.status}
    </span>
  </div>

  {#if is404}
    <SearchX class="text-muted-foreground h-16 w-16" />
    <h1 class="text-2xl font-semibold">{msg(m.error_404_title, 'Page Not Found')}</h1>
    <p class="text-muted-foreground max-w-md text-balance">
      {msg(
        m.error_404_description,
        "The page you are looking for doesn't exist or has been moved."
      )}
    </p>
    <div class="flex gap-4">
      <Button onclick={() => goto('/')}>
        {msg(m.error_404_action, 'Go Home')}
      </Button>
      <Button variant="ghost" onclick={goBack}>
        {msg(m.common_go_back, 'Go Back')}
      </Button>
    </div>
  {:else}
    <TriangleAlert class="text-destructive h-16 w-16" />
    <h1 class="text-2xl font-semibold">{msg(m.error_title, 'Something Went Wrong')}</h1>
    <p class="text-muted-foreground max-w-md text-balance">
      {page.error?.message ?? 'An unexpected error occurred.'}
    </p>
    <Button onclick={() => goto('/')}>
      {msg(m.error_action, 'Go Home')}
    </Button>
  {/if}
</div>
