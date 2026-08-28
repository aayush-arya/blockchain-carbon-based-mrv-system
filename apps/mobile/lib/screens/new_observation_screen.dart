import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../models/ecosystem.dart';
import '../models/queued_observation.dart';
import '../state/sync_provider.dart';
import '../theme.dart';
import '../widgets/app_shell.dart';

class NewObservationScreen extends StatefulWidget {
  const NewObservationScreen({super.key});

  @override
  State<NewObservationScreen> createState() => _NewObservationScreenState();
}

class _NewObservationScreenState extends State<NewObservationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _areaController = TextEditingController();
  final _notesController = TextEditingController();
  final _picker = ImagePicker();

  EcosystemCode _ecosystem = EcosystemCode.mangrove;
  Uint8List? _imageBytes;
  String? _imageFilename;
  String? _imageMimeType;
  double? _latitude;
  double? _longitude;
  DateTime _capturedAt = DateTime.now();
  bool _locating = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _areaController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final file = await _picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _imageBytes = bytes;
      _imageFilename = file.name;
      _imageMimeType = file.mimeType ?? 'image/jpeg';
    });
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _locating = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw Exception('Location permission denied');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not read location: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_imageBytes == null) {
      setState(() => _error = 'An evidence photo is required.');
      return;
    }
    if (_latitude == null || _longitude == null) {
      setState(() => _error = 'Location is required. Tap "Use current location".');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final observation = QueuedObservation(
      localId: const Uuid().v4(),
      ecosystemCode: _ecosystem.apiValue,
      latitude: _latitude!,
      longitude: _longitude!,
      capturedAt: _capturedAt.toUtc().toIso8601String(),
      reportedAreaM2: double.parse(_areaController.text),
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      imageBytes: _imageBytes!,
      imageFilename: _imageFilename ?? 'evidence.jpg',
      imageMimeType: _imageMimeType ?? 'image/jpeg',
      queuedAt: DateTime.now().toUtc().toIso8601String(),
    );

    await context.read<SyncProvider>().enqueue(observation);

    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Observation')),
      body: SafeArea(
        child: SingleChildScrollView(
          child: AppShell(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                _PhotoPicker(
                  imageBytes: _imageBytes,
                  onCamera: () => _pickImage(ImageSource.camera),
                  onGallery: () => _pickImage(ImageSource.gallery),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<EcosystemCode>(
                  initialValue: _ecosystem,
                  decoration: const InputDecoration(labelText: 'Ecosystem type'),
                  items: EcosystemCode.values
                      .map((e) => DropdownMenuItem(value: e, child: Text(e.label)))
                      .toList(),
                  onChanged: (v) => setState(() => _ecosystem = v!),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _locating ? null : _useCurrentLocation,
                  icon: _locating
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location),
                  label: Text(
                    _latitude != null
                        ? '${_latitude!.toStringAsFixed(5)}, ${_longitude!.toStringAsFixed(5)}'
                        : 'Use current location',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _areaController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Reported area (m²)'),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Area is required';
                    final n = double.tryParse(v);
                    if (n == null || n <= 0) return 'Enter a valid area';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Captured at'),
                  subtitle: Text(_capturedAt.toString()),
                  trailing: const Icon(Icons.edit_calendar_outlined),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _capturedAt,
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now(),
                    );
                    if (date == null || !context.mounted) return;
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(_capturedAt),
                    );
                    if (time == null) return;
                    setState(() {
                      _capturedAt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
                    });
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _notesController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    alignLabelWithHint: true,
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save observation'),
                ),
                const SizedBox(height: 4),
                Text(
                  'Saved to this device immediately and uploaded automatically - even offline.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkFaint),
                ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PhotoPicker extends StatelessWidget {
  final Uint8List? imageBytes;
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  const _PhotoPicker({required this.imageBytes, required this.onCamera, required this.onGallery});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceSunken,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: imageBytes != null
                ? Image.memory(imageBytes!, fit: BoxFit.cover)
                : const Center(
                    child: Icon(Icons.landscape_outlined, size: 48, color: AppColors.inkFaint),
                  ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onCamera,
                icon: const Icon(Icons.camera_alt_outlined),
                label: const Text('Camera'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onGallery,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Gallery'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
