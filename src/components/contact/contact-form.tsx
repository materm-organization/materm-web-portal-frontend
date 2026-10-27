"use client";

import { useTranslations } from "next-intl";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from "react";

import { submitContact } from "@/app/(public)/contact/actions";
import { ContactField } from "@/components/contact/contact-field";
import {
  CONTACT_INITIAL_STATE,
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  firstInvalidField,
  sanitizeContactValues,
  validateContact,
  validateContactField,
  type ContactErrors,
  type ContactField as ContactFieldName,
  type ContactFieldError,
} from "@/components/contact/contact-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labelClassName } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Contact form panel. Needs the server-only env var CONTACT_ENDPOINT to deliver
// messages (see contact-validation.ts and the README "Contact form" section).

const PANEL_CLASS =
  "rounded-site-card border border-site-line bg-white p-6 sm:p-8 lg:p-10";
const TITLE_CLASS =
  "text-2xl font-bold text-site-ink-strong uppercase sm:text-[28px] sm:leading-tight";

function readValues(form: HTMLFormElement) {
  return sanitizeContactValues(
    Object.fromEntries(new FormData(form)) as Partial<Record<ContactFieldName, unknown>>,
  );
}

function SuccessView({ onReset }: { onReset: () => void }) {
  const t = useTranslations("contact");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-5">
      <span aria-hidden="true" className="block h-3 w-3.5 bg-site-green-600 sm:h-4" />
      <h3
        ref={headingRef}
        tabIndex={-1}
        className={cn(TITLE_CLASS, "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-green-700")}
      >
        {t("form.success.title")}
      </h3>
      <p className="text-base text-site-ink sm:text-lg">{t("form.success.description")}</p>
      <Button
        type="button"
        variant="link"
        onClick={onReset}
        className="h-auto rounded-none p-0 text-base font-semibold text-site-green-700 underline hover:text-site-green-600"
      >
        {t("form.success.again")}
      </Button>
    </div>
  );
}

function ContactFormPanel({ onReset }: { onReset: () => void }) {
  const t = useTranslations("contact");
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(submitContact, CONTACT_INITIAL_STATE);

  const [errors, setErrors] = useState<ContactErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [serverCode, setServerCode] = useState<"unconfigured" | "generic" | undefined>();

  // Adopt each new server result during render (no effect, no extra paint).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setErrors(state.errors ?? {});
    setShowSummary(Object.keys(state.errors ?? {}).length > 0);
    setServerCode(state.code);
  }

  const id = (name: string) => `${baseId}-${name}`;

  const focusField = (field: ContactFieldName) => {
    formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  };

  // Server rejected fields: put the cursor on the first one.
  useEffect(() => {
    if (state.status !== "error" || !state.errors) return;
    const first = firstInvalidField(state.errors);
    if (first) focusField(first);
  }, [state]);

  const errorText = (code: ContactFieldError | undefined) => {
    if (!code) return undefined;
    const key = `form.errors.${code}`;
    // `phone` has no dedicated copy in older message files: fall back to "required".
    return t.has(key) ? t(key) : t("form.errors.required");
  };

  const setFieldError = (field: ContactFieldName, error: ContactFieldError | undefined) => {
    setErrors((prev) => {
      if (prev[field] === error) return prev;
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const handleBlur =
    (field: ContactFieldName) =>
    (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const form = event.currentTarget.form;
      if (!form) return;
      // Tabbing through an empty field is not an error yet; submit reports it.
      if (event.currentTarget.value.trim() === "" && !errors[field]) return;
      setFieldError(field, validateContactField(field, readValues(form)));
    };

  const handleChange =
    (field: ContactFieldName) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const form = event.currentTarget.form;
      if (!form || !errors[field]) return;
      setFieldError(field, validateContactField(field, readValues(form)));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const found = validateContact(readValues(event.currentTarget));
    setServerCode(undefined);
    setErrors(found);
    setShowSummary(Object.keys(found).length > 0);
    const first = firstInvalidField(found);
    if (first) {
      // Block the server action; the typed values stay in the inputs.
      event.preventDefault();
      focusField(first);
    }
  };

  const describedBy = (field: ContactFieldName) =>
    errors[field] ? `${id(field)}-error` : undefined;

  const hasErrors = Object.keys(errors).length > 0;
  const banner = serverCode ? t(`form.errors.${serverCode}`) : undefined;
  const values = state.values;

  if (state.status === "success") {
    return (
      <div className={PANEL_CLASS}>
        <SuccessView onReset={onReset} />
      </div>
    );
  }

  return (
    <div className={PANEL_CLASS}>
      <div className="flex flex-col gap-3">
        <h3 id={id("title")} className={TITLE_CLASS}>
          {t("form.title")}
        </h3>
        <p className="text-base text-site-ink sm:text-lg">{t("form.description")}</p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby={id("title")}
        aria-busy={pending}
        className="mt-8 flex flex-col gap-6"
      >
        {showSummary && hasErrors ? (
          <p role="alert" className="border border-destructive p-4 text-base text-destructive">
            {t("form.errors.summary")}
          </p>
        ) : null}
        {banner ? (
          <p role="alert" className="border border-destructive p-4 text-base text-destructive">
            {banner}
          </p>
        ) : null}

        <ContactField id={id("name")} label={t("form.fields.name.label")} error={errorText(errors.name)}>
          <Input
            id={id("name")}
            name="name"
            type="text"
            autoComplete="name"
            maxLength={CONTACT_LIMITS.nameMax}
            placeholder={t("form.fields.name.placeholder")}
            defaultValue={values?.name ?? ""}
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            onBlur={handleBlur("name")}
            onChange={handleChange("name")}
          />
        </ContactField>

        <ContactField id={id("email")} label={t("form.fields.email.label")} error={errorText(errors.email)}>
          <Input
            id={id("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={CONTACT_LIMITS.emailMax}
            placeholder={t("form.fields.email.placeholder")}
            defaultValue={values?.email ?? ""}
            aria-required="true"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email")}
            onBlur={handleBlur("email")}
            onChange={handleChange("email")}
          />
        </ContactField>

        <ContactField id={id("phone")} label={t("form.fields.phone.label")} error={errorText(errors.phone)}>
          <Input
            id={id("phone")}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={CONTACT_LIMITS.phoneMax}
            placeholder={t("form.fields.phone.placeholder")}
            defaultValue={values?.phone ?? ""}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy("phone")}
            onBlur={handleBlur("phone")}
            onChange={handleChange("phone")}
          />
        </ContactField>

        <div className="flex flex-col gap-2">
          <span id={id("topic-label")} className={labelClassName}>
            {t("form.fields.topic.label")}
          </span>
          <RadioGroup
            name="topic"
            required
            defaultValue={values?.topic || "booking"}
            aria-labelledby={id("topic-label")}
            className="grid grid-cols-2 gap-3"
          >
            {CONTACT_TOPICS.map((topic) => (
              <label
                key={topic}
                htmlFor={id(`topic-${topic}`)}
                className="flex min-h-12 cursor-pointer items-center gap-3 border border-site-line bg-white px-4 py-3 text-base font-medium text-site-ink transition-colors hover:border-site-green-700 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-site-green-700 has-data-[state=checked]:border-site-green-900 has-data-[state=checked]:bg-site-green-900 has-data-[state=checked]:text-white"
              >
                <RadioGroupItem
                  id={id(`topic-${topic}`)}
                  value={topic}
                  className="focus-visible:outline-0 data-[state=checked]:border-white"
                />
                {t(`form.fields.topic.options.${topic}`)}
              </label>
            ))}
          </RadioGroup>
        </div>

        <ContactField
          id={id("message")}
          label={t("form.fields.message.label")}
          error={errorText(errors.message)}
        >
          <Textarea
            id={id("message")}
            name="message"
            maxLength={CONTACT_LIMITS.messageMax}
            placeholder={t("form.fields.message.placeholder")}
            defaultValue={values?.message ?? ""}
            aria-required="true"
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={describedBy("message")}
            onBlur={handleBlur("message")}
            onChange={handleChange("message")}
          />
        </ContactField>

        {/* Honeypot: invisible to people and assistive tech, bots fill it. */}
        <div aria-hidden="true" className="sr-only">
          <input type="text" name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="site"
            size="site"
            disabled={pending}
            className="w-full sm:h-[61px] sm:w-[294px]"
          >
            {pending ? t("form.sending") : t("form.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ContactForm() {
  // Bumping the key remounts the panel, which resets `useActionState` to idle.
  const [formKey, setFormKey] = useState(0);
  return <ContactFormPanel key={formKey} onReset={() => setFormKey((k) => k + 1)} />;
}
