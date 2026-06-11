<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  {
    variant: 'primary',
    disabled: false,
    type: 'button',
  },
);
</script>

<template>
  <button
    :type="type"
    class="vp-btn"
    :class="[`vp-btn--${variant}`, { 'vp-btn--disabled': disabled }]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.vp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.7rem 1.25rem;
  border: 1px solid transparent;
  border-radius: 0.875rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease,
    background 0.15s ease;
}

.vp-btn:hover:not(:disabled) {
  opacity: 0.95;
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
}

.vp-btn--primary {
  background: linear-gradient(135deg, #3d83ff, #0962ff);
  color: #fff;
}

.vp-btn--secondary {
  border-color: #dbeafe;
  background: #eef6ff;
  color: #0b3f91;
}

.vp-btn--danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}

.vp-btn--disabled,
.vp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
