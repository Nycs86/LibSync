import 'package:flutter/material.dart';

import '../../services/auth_session.dart';
import '../../services/student_profile_service.dart';
import '../login_screen.dart';

class StudentProfile extends StatefulWidget {
  final int userId;

  const StudentProfile({
    super.key,
    required this.userId,
  });

  @override
  State<StudentProfile> createState() => _StudentProfileState();
}

class _StudentProfileState extends State<StudentProfile> {
  final StudentProfileService _profileService =
      StudentProfileService();

  final _studentNumberController = TextEditingController();
  final _nameController = TextEditingController();
  final _yearController = TextEditingController();
  final _programController = TextEditingController();
  final _collegeController = TextEditingController();
  final _genderController = TextEditingController();

  Map<String, dynamic>? _profile;
  String _errorMessage = '';
  bool _isLoading = true;
  bool _isEditing = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _studentNumberController.dispose();
    _nameController.dispose();
    _yearController.dispose();
    _programController.dispose();
    _collegeController.dispose();
    _genderController.dispose();
    super.dispose();
  }

  Future<void> _goToLogin() async {
    AuthSession.clear();

    if (!mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => const LoginScreen(),
      ),
      (route) => false,
    );
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final result = await _profileService.getStudentProfile(
      userId: widget.userId,
    );

    if (!mounted) return;

    if (result['sessionExpired'] == true) {
      setState(() {
        _isLoading = false;
        _errorMessage =
            result['message']?.toString() ??
            'Your session has expired. Please log in again.';
      });
      return;
    }

    if (result['success'] == true) {
      final data = result['profile'];

      final profile = data is Map<String, dynamic>
          ? data
          : <String, dynamic>{};

      _fillControllers(profile);

      setState(() {
        _profile = profile;
        _isLoading = false;
        _errorMessage = '';
      });
      return;
    }

    setState(() {
      _isLoading = false;
      _profile = null;
      _errorMessage =
          result['message']?.toString() ??
          'Unable to load student profile.';
    });
  }

  void _fillControllers(Map<String, dynamic> profile) {
    _studentNumberController.text =
        profile['student_number']?.toString() ?? '';
    _nameController.text =
        profile['name']?.toString() ?? '';
    _yearController.text =
        profile['year_level']?.toString() ?? '';
    _programController.text =
        profile['program']?.toString() ?? '';
    _collegeController.text =
        profile['college']?.toString() ?? '';
    _genderController.text =
        profile['gender']?.toString() ?? '';
  }

  Future<void> _saveProfile() async {
    final name = _nameController.text.trim();

    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Name is required.'),
        ),
      );
      return;
    }

    final yearText = _yearController.text.trim();

    if (yearText.isNotEmpty) {
      final year = int.tryParse(yearText);

      if (year == null || year < 1 || year > 6) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Year level must be a number from 1 to 6.',
            ),
          ),
        );
        return;
      }
    }

    setState(() {
      _isSaving = true;
    });

    final result = await _profileService.updateStudentProfile(
      userId: widget.userId,
      name: name,
      studentNumber: _studentNumberController.text,
      program: _programController.text,
      college: _collegeController.text,
      yearLevel: _yearController.text,
      gender: _genderController.text,
    );

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    if (result['sessionExpired'] == true) {
      await _goToLogin();
      return;
    }

    if (result['success'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message']?.toString() ??
                'Unable to update profile.',
          ),
        ),
      );
      return;
    }

    setState(() {
      _isEditing = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result['message']?.toString() ??
              'Profile updated successfully.',
        ),
      ),
    );

    await _loadProfile();
  }

  String _displayValue(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? 'Not provided' : text;
  }

  Widget _profileRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 14,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFE1E8E4),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFE7F2EE),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF77827B),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _editField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(),
      ),
    );
  }

  Widget _buildEditForm(Map<String, dynamic> profile) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Edit Profile',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            TextButton(
              onPressed: _isSaving
                  ? null
                  : () {
                      _fillControllers(profile);

                      setState(() {
                        _isEditing = false;
                      });
                    },
              child: const Text('Cancel'),
            ),
          ],
        ),
        const SizedBox(height: 24),
        _editField(
          controller: _studentNumberController,
          label: 'Student ID',
          icon: Icons.badge_outlined,
        ),
        const SizedBox(height: 14),
        _editField(
          controller: _nameController,
          label: 'Name',
          icon: Icons.person_outline,
        ),
        const SizedBox(height: 14),
        _editField(
          controller: _yearController,
          label: 'Year',
          icon: Icons.school_outlined,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 14),
        _editField(
          controller: _programController,
          label: 'Program',
          icon: Icons.menu_book_outlined,
        ),
        const SizedBox(height: 14),
        _editField(
          controller: _collegeController,
          label: 'College',
          icon: Icons.account_balance_outlined,
        ),
        const SizedBox(height: 14),
        _editField(
          controller: _genderController,
          label: 'Gender',
          icon: Icons.wc_outlined,
        ),
        const SizedBox(height: 14),
        TextField(
          enabled: false,
          controller: TextEditingController(
            text: _displayValue(profile['email']),
          ),
          decoration: const InputDecoration(
            labelText: 'Email',
            prefixIcon: Icon(Icons.email_outlined),
            border: OutlineInputBorder(),
            helperText: 'Email cannot be changed here.',
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 50,
          child: FilledButton.icon(
            onPressed: _isSaving ? null : _saveProfile,
            icon: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(
              _isSaving ? 'Saving...' : 'Save Changes',
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_errorMessage.isNotEmpty) {
      final sessionExpired = !AuthSession.isAuthenticated;

      return ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'Profile',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 24),
          const Icon(
            Icons.error_outline,
            size: 48,
            color: Color(0xFFB42318),
          ),
          const SizedBox(height: 12),
          Text(
            _errorMessage,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF77827B),
            ),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: sessionExpired
                ? _goToLogin
                : _loadProfile,
            icon: Icon(
              sessionExpired
                  ? Icons.login
                  : Icons.refresh,
            ),
            label: Text(
              sessionExpired
                  ? 'Log In Again'
                  : 'Try Again',
            ),
          ),
        ],
      );
    }

    final profile = _profile ?? <String, dynamic>{};

    if (_isEditing) {
      return _buildEditForm(profile);
    }

    final name = _displayValue(profile['name']);

    return RefreshIndicator(
      onRefresh: _loadProfile,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(18),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Profile',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: () {
                  _fillControllers(profile);

                  setState(() {
                    _isEditing = true;
                  });
                },
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Center(
            child: CircleAvatar(
              radius: 46,
              backgroundColor: const Color(0xFFE7F2EE),
              child: Text(
                name == 'Not provided'
                    ? 'S'
                    : name.substring(0, 1).toUpperCase(),
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Center(
            child: Text(
              name,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Center(
            child: Text(
              _displayValue(profile['email']),
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF77827B),
              ),
            ),
          ),
          const SizedBox(height: 24),
          _profileRow(
            icon: Icons.badge_outlined,
            label: 'Student ID',
            value: _displayValue(profile['student_number']),
          ),
          const SizedBox(height: 12),
          _profileRow(
            icon: Icons.person_outline,
            label: 'Name',
            value: name,
          ),
          const SizedBox(height: 12),
          _profileRow(
            icon: Icons.school_outlined,
            label: 'Year',
            value: _displayValue(profile['year_level']),
          ),
          const SizedBox(height: 12),
          _profileRow(
            icon: Icons.menu_book_outlined,
            label: 'Program',
            value: _displayValue(profile['program']),
          ),
          const SizedBox(height: 12),
          _profileRow(
            icon: Icons.account_balance_outlined,
            label: 'College',
            value: _displayValue(profile['college']),
          ),
          const SizedBox(height: 12),
          _profileRow(
            icon: Icons.wc_outlined,
            label: 'Gender',
            value: _displayValue(profile['gender']),
          ),
          const SizedBox(height: 16),
          const Text(
            'Pull down to refresh your profile.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF77827B),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
