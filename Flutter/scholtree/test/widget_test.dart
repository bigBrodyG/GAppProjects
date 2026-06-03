import 'package:flutter_test/flutter_test.dart';
import 'package:scholtree/main.dart';

void main() {
  testWidgets('login screen loads', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pump();

    expect(find.text('scholtree'), findsOneWidget);
    expect(find.text('accedi'), findsOneWidget);
  });
}
