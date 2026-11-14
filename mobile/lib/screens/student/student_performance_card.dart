import 'package:flutter/material.dart';

import '../../services/student_performance_service.dart';

/// Insert `const StudentPerformanceCard()` into the Student Home ListView.
/// This card uses backend-calculated scores rather than recalculating in Flutter.
class StudentPerformanceCard extends StatefulWidget {
  const StudentPerformanceCard({super.key});

  @override
  State<StudentPerformanceCard> createState() => _StudentPerformanceCardState();
}

class _StudentPerformanceCardState extends State<StudentPerformanceCard> {
  final StudentPerformanceService _service = StudentPerformanceService();
  Map<String, dynamic>? _performance;
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;
  bool _showAll = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await _service.getMyPerformance();
      if (!mounted) return;
      setState(() {
        _performance = Map<String, dynamic>.from(data['performance'] as Map);
        _history = (data['history'] as List)
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _loading = false; _error = error.toString().replaceFirst('Exception: ', ''); });
    }
  }

  int _integer(dynamic value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;

  String _date(dynamic value) {
    if (value == null) return 'Unavailable';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    final local = parsed.toLocal();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    return '${months[local.month - 1]} ${local.day}, ${local.year} • $hour:$minute ${local.hour < 12 ? 'AM' : 'PM'}';
  }

  Color _color(String level) {
    switch (level.toLowerCase()) {
      case 'high': return const Color(0xFF167C4A);
      case 'medium': return const Color(0xFFA76A00);
      default: return const Color(0xFFBA3030);
    }
  }

  Widget _count(String title, int value) => Expanded(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF60766B))),
      const SizedBox(height: 4),
      Text('$value', style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
    ]),
  );

  Widget _historyEntry(Map<String, dynamic> item) {
    final late = item['outcome'] == 'late';
    final change = _integer(item['points_change']);
    final rulePoints = _integer(item['rule_points']);
    final before = _integer(item['score_before']);
    final after = _integer(item['score_after']);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAF8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE6EEE8)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('${item['book_title'] ?? 'Returned book'}',
              style: const TextStyle(fontWeight: FontWeight.w700))),
          const SizedBox(width: 8),
          Text('${change > 0 ? '+' : ''}$change',
              style: TextStyle(fontWeight: FontWeight.w800,
                  color: change < 0 ? const Color(0xFFBA3030) : const Color(0xFF167C4A))),
        ]),
        const SizedBox(height: 6),
        Text(late ? 'Late • ${_integer(item['days_late'])} day(s)' : 'On-time return',
            style: TextStyle(fontWeight: FontWeight.w600,
                color: late ? const Color(0xFFBA3030) : const Color(0xFF167C4A))),
        const SizedBox(height: 5),
        Text('Due: ${_date(item['due_date'])}', style: const TextStyle(fontSize: 12)),
        Text('Returned: ${_date(item['returned_at'])}', style: const TextStyle(fontSize: 12)),
        const SizedBox(height: 5),
        Text('Score: $before → $after  •  Rule: ${rulePoints > 0 ? '+' : ''}$rulePoints pts',
            style: const TextStyle(fontSize: 12, color: Color(0xFF506A5D))),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = _performance;
    final score = _integer(p?['performance_score']).clamp(0, 100);
    final level = p?['performance_level']?.toString() ?? 'High';
    final tone = _color(level);
    final items = _showAll ? _history : _history.take(4).toList();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2EDE6)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('My Return Performance',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800))),
          IconButton(onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh), tooltip: 'Refresh score'),
        ]),
        if (_loading && p == null) ...[
          const SizedBox(height: 12),
          const Center(child: CircularProgressIndicator()),
        ] else if (p == null) ...[
          const SizedBox(height: 10),
          Text(_error ?? 'Performance is not available.',
              style: const TextStyle(color: Color(0xFFBA3030))),
          TextButton(onPressed: _load, child: const Text('Try again')),
        ] else ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: tone.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(20)),
            child: Text('$level Performance',
                style: TextStyle(color: tone, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 12),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('$score', style: TextStyle(fontSize: 43, fontWeight: FontWeight.w900, color: tone)),
            const Padding(padding: EdgeInsets.only(bottom: 8), child: Text(' / 100')),
          ]),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: LinearProgressIndicator(value: score / 100, minHeight: 10,
              color: tone, backgroundColor: const Color(0xFFE5EFE9)),
          ),
          const SizedBox(height: 10),
          const Text('Calculated from your completed book returns.',
              style: TextStyle(fontSize: 12, color: Color(0xFF62796D))),
          const SizedBox(height: 18),
          Row(children: [
            _count('Completed', _integer(p['completed_returns'])),
            _count('On-time', _integer(p['on_time_returns'])),
            _count('Late', _integer(p['late_returns'])),
          ]),
          const Divider(height: 30),
          const Text('Score History', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          const Text('See how every confirmed return changed your score.',
              style: TextStyle(color: Color(0xFF62796D), fontSize: 12)),
          const SizedBox(height: 12),
          if (_history.isEmpty)
            const Text('No completed book returns yet. Your starting score is 100.'),
          ...items.map(_historyEntry),
          if (_history.length > 4)
            Center(child: TextButton.icon(
              onPressed: () => setState(() => _showAll = !_showAll),
              icon: Icon(_showAll ? Icons.expand_less : Icons.expand_more),
              label: Text(_showAll ? 'Show Less' : 'View All (${_history.length})'),
            )),
          if (_error != null)
            Text('Latest refresh unavailable: $_error',
                style: const TextStyle(fontSize: 12, color: Color(0xFFBA3030))),
        ],
      ]),
    );
  }
}
