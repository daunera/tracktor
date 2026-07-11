<script lang="ts">
  import { page } from '$app/stores';
  import * as Card from '$lib/components/ui/card/index.js';
  import Tractor from '@lucide/svelte/icons/tractor';
  import Fuel from '@lucide/svelte/icons/fuel';
  import Wrench from '@lucide/svelte/icons/wrench';
  import Shield from '@lucide/svelte/icons/shield';
  import Bell from '@lucide/svelte/icons/bell';
  import {
    legal_nav_privacy,
    legal_nav_tos,
    landing_title,
    landing_subtitle,
    landing_feature_fuel,
    landing_feature_fuel_desc,
    landing_feature_maintenance,
    landing_feature_maintenance_desc,
    landing_feature_insurance,
    landing_feature_insurance_desc,
    landing_feature_reminders,
    landing_feature_reminders_desc
  } from '$lib/paraglide/messages';

  let { children } = $props();

  let currentPath = $derived($page.url.pathname);
  let isLandingPage = $derived(/^\/([a-z]{2}\/?)?$/.test(currentPath));
</script>

<div
  id="auth-container"
  class="bg-background flex w-full grow flex-col items-center justify-center gap-6 overflow-hidden p-4 md:p-10"
>
  <div id="auth-card-wrapper" class="w-full max-w-4xl">
    <Card.Root id="auth-card-root" class="overflow-hidden p-0">
      <Card.Content id="auth-card-content" class="grid p-0 md:grid-cols-2">
        <div
          id="auth-hero-section"
          class="bg-muted relative hidden flex-col justify-center gap-6 p-8 transition-all duration-300 md:flex"
        >
          {#if isLandingPage}
            <div id="landing-hero-content" class="flex flex-col gap-6">
              <div id="landing-hero-brand" class="flex items-center gap-3">
                <Tractor class="text-foreground h-8 w-8" />
                <div>
                  <h1 class="text-foreground text-2xl font-bold tracking-tight">
                    {landing_title()}
                  </h1>
                  <p class="text-muted-foreground mt-1 text-sm">{landing_subtitle()}</p>
                </div>
              </div>
              <div id="landing-hero-features" class="flex flex-col gap-4">
                <div class="flex items-start gap-3">
                  <Fuel class="text-foreground mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p class="text-foreground text-sm font-medium">{landing_feature_fuel()}</p>
                    <p class="text-muted-foreground text-xs">{landing_feature_fuel_desc()}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <Wrench class="text-foreground mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p class="text-foreground text-sm font-medium">
                      {landing_feature_maintenance()}
                    </p>
                    <p class="text-muted-foreground text-xs">
                      {landing_feature_maintenance_desc()}
                    </p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <Shield class="text-foreground mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p class="text-foreground text-sm font-medium">{landing_feature_insurance()}</p>
                    <p class="text-muted-foreground text-xs">{landing_feature_insurance_desc()}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <Bell class="text-foreground mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p class="text-foreground text-sm font-medium">{landing_feature_reminders()}</p>
                    <p class="text-muted-foreground text-xs">{landing_feature_reminders_desc()}</p>
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <img
              id="auth-hero-bg"
              src="hero-bg.svg"
              alt="placeholder"
              class="absolute inset-0 h-full w-full object-cover transition-all duration-300"
            />
            <Tractor
              id="auth-hero-icon"
              class="text-muted-foreground relative z-10 h-5 w-5 transition-all duration-300 dark:text-zinc-800"
            />
          {/if}
        </div>
        <div id="auth-form-section" class="flex items-center p-6 md:p-8">
          {#key currentPath}
            <div id="auth-form-wrapper" class="w-full">
              {@render children()}
            </div>
          {/key}
        </div>
      </Card.Content>
    </Card.Root>
  </div>
  <div class="text-muted-foreground flex items-center justify-center gap-4 text-xs">
    <a href="/privacy-policy" class="hover:text-foreground transition-colors">
      {legal_nav_privacy()}
    </a>
    <a href="/terms-of-service" class="hover:text-foreground transition-colors">
      {legal_nav_tos()}
    </a>
  </div>
</div>
