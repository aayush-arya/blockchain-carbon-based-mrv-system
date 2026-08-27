'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { mrvApi, observationsApi } from '@/lib/endpoints';
import { ECOSYSTEM_LABELS, formatCarbon } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Feedback';
import type { CarbonCalculationBreakdown, DuplicateSignal, EcosystemCode } from '@/lib/types';

type Step = 'capture' | 'analyze' | 'calculate' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'capture', label: 'Capture' },
  { key: 'analyze', label: 'AI Analysis' },
  { key: 'calculate', label: 'Carbon Estimate' },
  { key: 'done', label: 'Confirmation' },
];

function nowLocalDatetime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewObservationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('capture');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Capture form state
  const [ecosystemCode, setEcosystemCode] = useState<EcosystemCode>('mangrove');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [reportedAreaM2, setReportedAreaM2] = useState('');
  const [capturedAt, setCapturedAt] = useState(nowLocalDatetime());
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Pipeline state
  const [mrvId, setMrvId] = useState<string | null>(null);
  const [mrvCode, setMrvCode] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof mrvApi.analyze>>['analysis'] | null>(null);
  const [breakdown, setBreakdown] = useState<CarbonCalculationBreakdown | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateSignal[]>([]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError('Could not read your location. Enter coordinates manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function onImageChange(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleCaptureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image) {
      setError('An evidence photo is required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await observationsApi.create({
        ecosystemCode,
        latitude: Number(latitude),
        longitude: Number(longitude),
        capturedAt: new Date(capturedAt).toISOString(),
        reportedAreaM2: Number(reportedAreaM2),
        notes: notes || undefined,
        image,
      });
      if (created.duplicateWarning) setDuplicateWarning(created.duplicateWarning.message);

      const mrvRecord = await mrvApi.create(created.observationId);
      await mrvApi.submit(mrvRecord.mrvRecord.id);
      setMrvId(mrvRecord.mrvRecord.id);
      setMrvCode(mrvRecord.mrvRecord.mrv_code);
      setStep('analyze');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    if (!mrvId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await mrvApi.analyze(mrvId);
      setAnalysis(result.analysis);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'AI analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runCalculation() {
    if (!mrvId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await mrvApi.calculate(mrvId);
      setBreakdown(result.breakdown);
      setDuplicates(result.duplicates);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Carbon calculation failed.');
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div>
      <PageHeader title="New Observation" description="Capture field evidence and run it through analysis and carbon estimation." />

      <div className="mx-auto max-w-3xl px-8 py-6">
        <ol className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  i < stepIndex
                    ? 'bg-brand-600 text-white'
                    : i === stepIndex
                      ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                      : 'bg-surface-sunken text-ink-faint'
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs font-medium ${i <= stepIndex ? 'text-ink' : 'text-ink-faint'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className="mx-1 h-px flex-1 bg-border-subtle" />}
            </li>
          ))}
        </ol>

        {error && (
          <p className="mb-4 rounded border border-status-danger/30 bg-status-danger-bg px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}

        {step === 'capture' && (
          <Card>
            <CardHeader>
              <CardTitle>Field Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCaptureSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium text-ink">Evidence photo</label>
                  <div
                    className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-border bg-surface-sunken px-4 py-8 text-center hover:border-brand-400"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="Preview" className="max-h-56 rounded object-contain" />
                    ) : (
                      <p className="text-sm text-ink-faint">Click to choose a photo of the site</p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
                  />
                </div>

                <Select
                  label="Ecosystem type"
                  value={ecosystemCode}
                  onChange={(e) => setEcosystemCode(e.target.value as EcosystemCode)}
                  required
                >
                  {Object.entries(ECOSYSTEM_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitude"
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="21.6417"
                  />
                  <Input
                    label="Longitude"
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="87.9959"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" loading={locating} onClick={useMyLocation} className="self-start">
                  Use my current location
                </Button>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Reported area (m²)"
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={reportedAreaM2}
                    onChange={(e) => setReportedAreaM2(e.target.value)}
                    placeholder="2500"
                  />
                  <Input
                    label="Captured at"
                    type="datetime-local"
                    required
                    value={capturedAt}
                    onChange={(e) => setCapturedAt(e.target.value)}
                    max={nowLocalDatetime()}
                  />
                </div>

                <Textarea
                  label="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Site conditions, tide level, anything relevant…"
                />

                <Button type="submit" loading={busy} className="mt-2">
                  Submit observation
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'analyze' && (
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis — {mrvCode}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {duplicateWarning && (
                <p className="rounded border border-status-warning/30 bg-status-warning-bg px-3 py-2 text-sm text-status-warning">
                  {duplicateWarning}
                </p>
              )}
              {!analysis && !busy && (
                <>
                  <p className="text-sm text-ink-muted">
                    Run the vegetation coverage and ecosystem classification model against the submitted photo.
                  </p>
                  <Button onClick={runAnalysis}>Run AI analysis</Button>
                </>
              )}
              {busy && (
                <div className="flex items-center gap-2 py-6 text-sm text-ink-faint">
                  <Spinner /> Analyzing evidence…
                </div>
              )}
              {analysis && (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Stat label="Predicted ecosystem" value={ECOSYSTEM_LABELS[analysis.predictedEcosystem]} />
                    <Stat label="Confidence" value={`${Math.round(analysis.confidence * 100)}%`} />
                    <Stat label="Vegetation coverage" value={`${analysis.vegetationCoveragePct.toFixed(1)}%`} />
                  </div>
                  {analysis.warnings.length > 0 &&
                    analysis.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-status-warning">
                        ⚠ {w}
                      </p>
                    ))}
                  <Button
                    onClick={() => {
                      setStep('calculate');
                    }}
                  >
                    Continue
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'calculate' && (
          <Card>
            <CardHeader>
              <CardTitle>Carbon Estimate — {mrvCode}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!breakdown && !busy && (
                <>
                  <p className="text-sm text-ink-muted">
                    Calculate the estimated annual carbon sequestration for this observation.
                  </p>
                  <Button onClick={runCalculation}>Calculate carbon estimate</Button>
                </>
              )}
              {busy && (
                <div className="flex items-center gap-2 py-6 text-sm text-ink-faint">
                  <Spinner /> Calculating…
                </div>
              )}
              {breakdown && (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Stat label="Effective area" value={`${breakdown.effective_area_m2.toFixed(1)} m²`} />
                    <Stat label="Carbon factor" value={`${breakdown.carbon_factor_value} ${breakdown.carbon_factor_unit}`} />
                    <Stat label="Estimated carbon" value={formatCarbon(breakdown.estimated_carbon_tco2e)} />
                  </div>
                  <p className="rounded bg-surface-sunken px-3 py-2 text-xs text-ink-faint">{breakdown.formula}</p>
                  {duplicates.length > 0 && (
                    <div className="rounded border border-status-warning/30 bg-status-warning-bg px-3 py-2 text-sm text-status-warning">
                      <p className="font-medium">Possible duplicate submissions detected</p>
                      {duplicates.map((d, i) => (
                        <p key={i} className="mt-1 text-xs">
                          {d.detail}
                        </p>
                      ))}
                    </div>
                  )}
                  <Button onClick={() => setStep('done')}>Finish</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg text-status-success">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-ink">{mrvCode} is pending validation</p>
                <p className="mt-1 text-sm text-ink-muted">
                  A validator will review this record before it can be tokenized as a carbon asset.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/mrv/${mrvId}`)}>
                  View record
                </Button>
                <Link href="/observations/new">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep('capture');
                      setMrvId(null);
                      setMrvCode(null);
                      setAnalysis(null);
                      setBreakdown(null);
                      setDuplicates([]);
                      setDuplicateWarning(null);
                      onImageChange(null);
                      setNotes('');
                      setLatitude('');
                      setLongitude('');
                      setReportedAreaM2('');
                    }}
                  >
                    Submit another
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
