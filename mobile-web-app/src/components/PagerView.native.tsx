import { forwardRef, useImperativeHandle, useRef } from 'react';
import PagerView from 'react-native-pager-view';

export interface CrossPagerRef {
  setPage: (index: number) => void;
}

interface CrossPagerProps {
  initialPage: number;
  onPageSelected: (e: { nativeEvent: { position: number } }) => void;
  children: React.ReactNode;
  style?: any;
}

const CrossPager = forwardRef<CrossPagerRef, CrossPagerProps>(
  ({ initialPage, onPageSelected, children, style }, ref) => {
    const pagerRef = useRef<PagerView>(null);

    useImperativeHandle(ref, () => ({
      setPage: (index: number) => pagerRef.current?.setPage(index),
    }));

    return (
      <PagerView
        ref={pagerRef}
        style={style}
        initialPage={initialPage}
        onPageSelected={onPageSelected}
      >
        {children}
      </PagerView>
    );
  }
);

export default CrossPager;
